import {
  addDoc, deleteDoc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch, type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import { audit, col, nextCode, ref } from './db';
import { inspectionId, statusAfterWork, summarize } from './rules';
import type { Discipline, Equipment, Inspection, PartResult, Shutdown, UserProfile } from '../types';

const online = () => navigator.onLine;

/**
 * Online: wait (up to 10 s) until the server confirms the write, so a record is never only on the device
 * when the user believes it was created. Offline: the write is queued locally and synced later.
 */
async function commit(p: Promise<unknown>, what: string) {
  const guarded = p.catch(e => { console.warn(what, e); throw e; });
  if (!online()) { guarded.catch(() => {}); return; }
  await Promise.race([guarded, new Promise(r => setTimeout(r, 10_000))]);
}

async function readInspection(id: string): Promise<Inspection> {
  const s = await getDoc(ref('inspections', id));
  if (!s.exists()) throw new Error('not-found');
  return { id: s.id, ...s.data() } as Inspection;
}

/**
 * Applies a change to an inspection with optimistic concurrency (docVersion + 1, enforced by rules).
 * Online it runs in a transaction so two people saving at once never overwrite each other.
 */
export async function mutateInspection(id: string, fn: (cur: Inspection) => DocumentData) {
  const build = (cur: Inspection) => ({ ...fn(cur), updatedAt: serverTimestamp(), docVersion: (cur.docVersion ?? 0) + 1 });
  if (online()) {
    return runTransaction(db, async tx => {
      const s = await tx.get(ref('inspections', id));
      if (!s.exists()) throw new Error('not-found');
      const cur = { id: s.id, ...s.data() } as Inspection;
      tx.update(s.ref, build(cur));
      return cur;
    });
  }
  const cur = await readInspection(id);
  updateDoc(ref('inspections', id), build(cur)).catch(e => console.warn('offline inspection update rejected', e));
  return cur;
}

/* ---------------- shutdown ---------------- */

/** The current yearly shutdown; created on first use. */
export async function ensureShutdown(user: UserProfile): Promise<Shutdown> {
  return startShutdown(user, new Date().getFullYear(), null);
}

/**
 * Starts a shutdown in one transaction on config/shutdown, so two devices (or two quick calls) can never
 * create two. `replaces` is the shutdown being closed; null = only if there is no current one yet.
 */
async function startShutdown(user: UserProfile, year: number, replaces: string | null): Promise<Shutdown> {
  const res = await runTransaction(db, async tx => {
    const cfgRef = ref('config', 'shutdown');
    const cfg = await tx.get(cfgRef);
    const current = cfg.exists() ? (cfg.data().currentId as string | undefined) ?? null : null;
    if (current && current !== replaces) {
      const s = await tx.get(ref('shutdowns', current));
      if (s.exists()) return { created: false, sd: { id: s.id, ...s.data() } as Shutdown };
    }
    const id = `SD-${year}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    // Same year as before: number it ("… 2026 (2)") so the names stay distinguishable until the administrator renames it.
    const taken = new Set((await getDocs(col('shutdowns')).catch(() => null))?.docs.map(d => d.data().name as string) ?? []);
    let name = `Annual shutdown ${year}`;
    for (let n = 2; taken.has(name); n++) name = `Annual shutdown ${year} (${n})`;
    const s = { name, year, status: 'open' as const, startedAt: serverTimestamp() };
    tx.set(ref('shutdowns', id), s);
    tx.set(cfgRef, { currentId: id, updatedAt: serverTimestamp(), updatedBy: user.id });
    return { created: true, sd: { id, ...s, startedAt: null } as Shutdown };
  });
  if (res.created) audit(user, 'shutdown.start', 'shutdown', res.sd.id, { label: res.sd.name });
  return res.sd;
}

/**
 * Closes the shutdown: every approved inspection moves to Done (archived), the active count goes back to 0
 * and the next yearly shutdown starts.
 */
export async function archiveShutdown(user: UserProfile, sd: Shutdown, inspections: Inspection[]) {
  const done = inspections.filter(i => i.shutdownId === sd.id && i.status === 'approved');
  for (let k = 0; k < done.length; k += 400) {
    const b = writeBatch(db);
    for (const i of done.slice(k, k + 400)) {
      b.update(ref('inspections', i.id), { status: 'archived', archivedAt: serverTimestamp(), updatedAt: serverTimestamp(), docVersion: (i.docVersion ?? 0) + 1 });
    }
    await b.commit();
  }
  await updateDoc(ref('shutdowns', sd.id), { status: 'closed', closedAt: serverTimestamp(), closedBy: user.id, closedByName: user.name, archived: done.length });
  audit(user, 'shutdown.close', 'shutdown', sd.id, { label: sd.name, note: `${done.length} inspections archived` });
  // The year is never advanced automatically; the administrator changes name and year by hand (Edit).
  return startShutdown(user, sd.year, sd.id);
}

/** Administrator: rename a shutdown / project or change its year; its inspections show the new name too. */
export async function renameShutdown(user: UserProfile, sd: Shutdown, name: string, year: number, inspections: Inspection[]) {
  await updateDoc(ref('shutdowns', sd.id), { name, year });
  const mine = inspections.filter(i => i.shutdownId === sd.id && i.shutdownName !== name);
  for (let k = 0; k < mine.length; k += 400) {
    const b = writeBatch(db);
    for (const i of mine.slice(k, k + 400)) b.update(ref('inspections', i.id), { shutdownName: name, updatedAt: serverTimestamp(), docVersion: (i.docVersion ?? 0) + 1 });
    await b.commit();
  }
  await audit(user, 'shutdown.edit', 'shutdown', sd.id, { label: name, before: { name: sd.name, year: sd.year }, after: { name, year } });
}

/* ---------------- inspections ---------------- */

/** One inspection per equipment and discipline in a shutdown; the title is the equipment name. */
export async function createInspection(user: UserProfile, sd: Shutdown, e: Equipment, d: Discipline): Promise<string> {
  const id = inspectionId(sd.id, e.id, d);
  const existing = await getDoc(ref('inspections', id)).catch(() => null);
  if (existing?.exists()) return id;
  const parts = (e.parts[d] ?? []).map((name, k) => ({ id: `p${k + 1}`, name }));
  const code = await nextCode('CR');
  const insp = {
    code, shutdownId: sd.id, shutdownName: sd.name, title: e.name, equipmentId: e.id, departmentId: e.departmentId, discipline: d,
    parts, results: {}, summary: summarize(parts, {}), status: 'pool', createdBy: user.id, createdByName: user.name,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), approval: null, rejection: null, docVersion: 1,
  };
  await commit(setDoc(ref('inspections', id), insp), 'create inspection');
  audit(user, 'inspection.create', 'inspection', id, { label: `${code} · ${e.name}` });
  return id;
}

/** Records OK / Not OK for one part (while the inspection waits in the pool). */
export async function savePart(user: UserProfile, inspId: string, partId: string, r: Pick<PartResult, 'status' | 'note' | 'photoIds'>) {
  await mutateInspection(inspId, cur => {
    const results = { ...cur.results, [partId]: { ...r, by: user.id, byName: user.name, at: new Date(), fix: null } };
    return { [`results.${partId}`]: { ...r, by: user.id, byName: user.name, at: serverTimestamp(), fix: null }, summary: summarize(cur.parts, results as Inspection['results']) };
  });
}

/** The team hands the inspection on: corrective maintenance if any part is Not OK, otherwise waiting approval. */
export async function submitInspection(user: UserProfile, insp: Inspection) {
  let next = 'pool';
  await mutateInspection(insp.id, cur => {
    const summary = summarize(cur.parts, cur.results);
    next = statusAfterWork(summary);
    return { summary, status: next, submittedAt: serverTimestamp(), rejection: null };
  });
  audit(user, 'inspection.submit', 'inspection', insp.id, { label: `${insp.code} · ${insp.title}`, note: next });
  return next;
}

/** Corrective maintenance done on a Not OK part; when the last one is fixed the inspection waits for approval. */
export async function fixPart(user: UserProfile, insp: Inspection, partId: string, note: string, photoIds: string[]) {
  let next = insp.status;
  await mutateInspection(insp.id, cur => {
    const fix = { note, photoIds, by: user.id, byName: user.name, at: new Date() };
    const results = { ...cur.results, [partId]: { ...cur.results[partId], fix } };
    const summary = summarize(cur.parts, results as Inspection['results']);
    next = statusAfterWork(summary);
    return { [`results.${partId}.fix`]: { ...fix, at: serverTimestamp() }, summary, status: next };
  });
  audit(user, 'inspection.fix', 'inspection', insp.id, { label: `${insp.code} · ${insp.title}`, note });
  return next;
}

/** Administrator: delete an inspection (any stage) together with its photos. */
export async function deleteInspection(user: UserProfile, insp: Inspection) {
  const files = await getDocs(query(col('attachments'), where('inspectionId', '==', insp.id))).catch(() => null);
  for (const f of files?.docs ?? []) await deleteDoc(f.ref).catch(() => {});
  await deleteDoc(ref('inspections', insp.id));
  audit(user, 'inspection.delete', 'inspection', insp.id, { label: `${insp.code} · ${insp.title}`, before: { status: insp.status, discipline: insp.discipline, shutdown: insp.shutdownName } });
}

export async function approveInspection(user: UserProfile, insp: Inspection, comment: string) {
  await mutateInspection(insp.id, () => ({ status: 'approved', approval: { by: user.id, byName: user.name, at: serverTimestamp(), comment } }));
  audit(user, 'inspection.approve', 'inspection', insp.id, { label: `${insp.code} · ${insp.title}`, note: comment });
}

/** Sends it back to the team's pool with a reason; results are kept so only what is wrong needs redoing. */
export async function rejectInspection(user: UserProfile, insp: Inspection, reason: string) {
  await mutateInspection(insp.id, () => ({ status: 'pool', approval: null, rejection: { by: user.id, byName: user.name, at: serverTimestamp(), reason } }));
  audit(user, 'inspection.reject', 'inspection', insp.id, { label: `${insp.code} · ${insp.title}`, note: reason });
  if (insp.createdBy !== user.id) {
    notify(insp.createdBy, { en: `${insp.title} (${insp.code}) was sent back: ${reason}`, ar: `أُعيد الفحص ${insp.title} (${insp.code}): ${reason}` }, `/inspections/${insp.id}`);
  }
}

/* ---------------- notifications ---------------- */
export function notify(toUid: string, title: { en: string; ar: string }, link: string) {
  return addDoc(col('notifications'), { toUid, title, link, read: false, createdAt: serverTimestamp() }).catch(() => {});
}
