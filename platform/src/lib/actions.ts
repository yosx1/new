import {
  addDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import { audit, col, ConflictError, nextCode, ref } from './db';
import { computePools, computeSummary, deriveStatus } from './rules';
import type {
  ApprovalRecord, Defect, Discipline, Inspection, ItemResult, UserProfile, Settings, Severity,
} from '../types';

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

/** Reads a document from the server when online, otherwise from the local cache. */
async function readInspection(id: string): Promise<Inspection> {
  const s = await getDoc(ref('inspections', id));
  if (!s.exists()) throw new Error('not-found');
  return { id: s.id, ...s.data() } as Inspection;
}

/**
 * Applies a change to an inspection with optimistic concurrency (docVersion + 1, enforced by rules).
 * Online it runs in a transaction so concurrent approvals never overwrite each other.
 */
export async function mutateInspection(id: string, fn: (cur: Inspection) => Partial<Inspection>) {
  const build = (cur: Inspection) => ({ ...fn(cur), updatedAt: serverTimestamp(), docVersion: (cur.docVersion ?? 0) + 1 });
  if (online()) {
    return runTransaction(db, async tx => {
      const s = await tx.get(ref('inspections', id));
      if (!s.exists()) throw new Error('not-found');
      const cur = { id: s.id, ...s.data() } as Inspection;
      tx.update(s.ref, build(cur) as DocumentData);
      return cur;
    });
  }
  const cur = await readInspection(id);
  updateDoc(ref('inspections', id), build(cur) as DocumentData).catch(e => console.warn('offline inspection update rejected', e));
  return cur;
}

/** Recomputes summary/status/pools from results and defects. Called after every relevant change. */
export async function syncInspection(
  id: string,
  opts: { results?: Record<string, ItemResult>; defects?: Defect[]; userAction?: boolean } = {},
) {
  let results = opts.results;
  if (!results) {
    const snap = await getDocs(col(`inspections/${id}/results`));
    results = Object.fromEntries(snap.docs.map(d => [d.id, { id: d.id, ...d.data() } as ItemResult]));
  }
  let defects = opts.defects;
  if (!defects) {
    const snap = await getDocs(query(col('defects'), where('inspectionId', '==', id)));
    defects = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Defect);
  }
  const res = results;
  const defs = defects;
  return mutateInspection(id, cur => {
    const summary = computeSummary(cur.checklist, res, defs);
    const status = deriveStatus(cur, summary, opts.userAction);
    return { summary, status, pools: computePools({ ...cur, status }, summary) };
  });
}

/** Is the stored summary out of date compared with live data? (self-healing after concurrent edits) */
export function summaryStale(insp: Inspection, results: Record<string, ItemResult>, defects: Defect[]) {
  const s = computeSummary(insp.checklist, results, defects);
  const a = insp.summary;
  return !a || s.pass !== a.pass || s.fail !== a.fail || s.na !== a.na || s.pending !== a.pending
    || s.openDefects !== a.openDefects || s.openCritical !== a.openCritical || s.awaitingVerification !== a.awaitingVerification;
}

/* ---------------- inspections ---------------- */

export async function createInspection(user: UserProfile, data: Omit<Inspection,
  'id' | 'code' | 'status' | 'summary' | 'pools' | 'approvals' | 'createdAt' | 'createdBy' | 'createdByName' | 'updatedAt' | 'docVersion' | 'override'>) {
  const code = await nextCode('CR');
  const summary = computeSummary(data.checklist, {}, []);
  const base = { ...data, approvals: {}, status: 'maintenance_completed' as const };
  const r = doc(col('inspections'));
  const record = {
    ...base, code, summary, pools: computePools(base, summary), override: null,
    createdAt: serverTimestamp(), createdBy: user.id, createdByName: user.name, updatedAt: serverTimestamp(), docVersion: 1,
  };
  await commit(setDoc(r, record), 'create inspection');
  audit(user, 'inspection.create', 'inspection', r.id, { label: code, after: { title: data.title, equipment: data.equipmentTag, wo: data.workOrder } });
  for (const uid of new Set([data.supervisorUid, data.productionEngUid, data.maintenanceEngUid, ...data.assignedUids])) {
    if (uid && uid !== user.id) notify(uid, { en: `You were added to inspection ${code}`, ar: `تمت إضافتك إلى الفحص ${code}` }, `/inspections/${r.id}`);
  }
  return { id: r.id, code };
}

export async function saveResult(
  user: UserProfile,
  insp: Inspection,
  next: Omit<ItemResult, 'rev' | 'inspectorUid' | 'inspectorName' | 'at'>,
  baseRev: number,
  force = false,
) {
  const r = ref(`inspections/${insp.id}/results`, next.id);
  let before: DocumentData | null = null;
  const record = { ...next, inspectorUid: user.id, inspectorName: user.name, at: serverTimestamp() };
  if (online()) {
    await runTransaction(db, async tx => {
      const s = await tx.get(r);
      const cur = s.exists() ? s.data() : null;
      before = cur;
      const curRev = (cur?.rev as number) ?? 0;
      if (curRev !== baseRev && !force) throw new ConflictError(cur!);
      tx.set(r, { ...record, rev: curRev + 1 });
    });
  } else {
    // Offline: queued. If a colleague changed it meanwhile, the rules reject the stale revision on sync.
    setDoc(r, { ...record, rev: baseRev + 1 }).catch(e => console.warn('offline result rejected', e));
  }
  audit(user, 'result.save', 'inspection', insp.id, {
    label: `${insp.code} · ${next.id}`,
    before: before ? { status: (before as DocumentData).status, value: (before as DocumentData).value ?? null } : null,
    after: { status: next.status, value: next.value ?? null, comment: next.comment ?? '' },
  });
}

export async function approveDiscipline(user: UserProfile, insp: Inspection, d: Discipline | 'final', decision: 'approved' | 'rejected', comment: string) {
  const rec: ApprovalRecord = { decision, by: user.id, byName: user.name, at: null, comment };
  await mutateInspection(insp.id, cur => {
    if (decision === 'rejected') {
      // A final rejection by a lead clears all sign-offs; a discipline rejection records only its own.
      const approvals = d === 'final' ? {} : { ...cur.approvals, [d]: { ...rec, at: new Date() as unknown as ApprovalRecord['at'] } };
      return { approvals, status: 'rejected', pools: computePools({ ...cur, approvals, status: 'rejected' }, cur.summary) };
    }
    const approvals = { ...cur.approvals, [d]: { ...rec, at: new Date() as unknown as ApprovalRecord['at'] } };
    const status = d === 'final' ? 'approved' : deriveStatus({ ...cur, approvals }, cur.summary, true);
    return { approvals, status, pools: computePools({ ...cur, approvals, status }, cur.summary) };
  });
  audit(user, decision === 'approved' ? `approval.${d}` : `rejection.${d}`, 'inspection', insp.id, { label: insp.code, note: comment });
  if (decision === 'rejected' && insp.supervisorUid !== user.id) {
    notify(insp.supervisorUid, { en: `Inspection ${insp.code} was rejected`, ar: `تم رفض الفحص ${insp.code}` }, `/inspections/${insp.id}`);
  }
}

export async function finalApprove(user: UserProfile, insp: Inspection, comment: string, override?: string) {
  await mutateInspection(insp.id, cur => {
    const approvals = { ...cur.approvals, final: { decision: 'approved' as const, by: user.id, byName: user.name, at: new Date() as unknown as ApprovalRecord['at'], comment } };
    return {
      approvals, status: 'approved', pools: [],
      ...(override ? { override: { by: user.id, byName: user.name, at: new Date() as unknown as ApprovalRecord['at'], justification: override } } : {}),
    };
  });
  audit(user, override ? 'approval.final.override' : 'approval.final', 'inspection', insp.id, { label: insp.code, note: override || comment });
}

export async function reopenInspection(user: UserProfile, insp: Inspection, reason: string) {
  await mutateInspection(insp.id, cur => {
    const status = deriveStatus({ ...cur, status: 'in_progress', approvals: {} }, cur.summary, true);
    return { status, approvals: {}, override: null, pools: computePools({ ...cur, approvals: {}, status }, cur.summary) };
  });
  audit(user, 'inspection.reopen', 'inspection', insp.id, { label: insp.code, note: reason });
}

export async function updateInfo(user: UserProfile, insp: Inspection, patch: Partial<Inspection>) {
  await mutateInspection(insp.id, () => patch);
  audit(user, 'inspection.edit', 'inspection', insp.id, { label: insp.code, after: patch as DocumentData });
}

/* ---------------- defects ---------------- */

export async function raiseDefect(user: UserProfile, settings: Settings, insp: Inspection, args: {
  itemId: string; itemLabel: Defect['itemLabel']; description: string; severity: Severity; pool: Discipline;
  targetDate: string; correctiveAction: string; assignedUid?: string | null; assignedName?: string | null; photoIds?: string[];
}) {
  void settings;
  const code = await nextCode('DF');
  const r = doc(col('defects'));
  const rec = {
    code, inspectionId: insp.id, inspectionCode: insp.code, departmentId: insp.departmentId,
    equipmentId: insp.equipmentId, equipmentTag: insp.equipmentTag, ...args,
    assignedUid: args.assignedUid ?? null, assignedName: args.assignedName ?? null,
    status: args.assignedUid ? 'assigned' : 'open', repair: null, verification: null, reopenCount: 0,
    reportedAt: serverTimestamp(), reportedBy: user.id, reportedByName: user.name, updatedAt: serverTimestamp(),
  };
  await commit(setDoc(r, rec), 'defect create');
  audit(user, 'defect.create', 'defect', r.id, { label: code, after: { severity: args.severity, pool: args.pool, item: args.itemId, inspection: insp.code } });
  if (args.assignedUid && args.assignedUid !== user.id) {
    notify(args.assignedUid, { en: `Defect ${code} assigned to you`, ar: `تم إسناد العيب ${code} إليك` }, `/defects/${r.id}`);
  }
  return { id: r.id, code };
}

export async function updateDefect(user: UserProfile, d: Defect, patch: Partial<Defect>, action: string, note = '') {
  await updateDoc(ref('defects', d.id), { ...patch, updatedAt: serverTimestamp() } as DocumentData);
  audit(user, 'defect.' + action, 'defect', d.id, {
    label: d.code, before: { status: d.status, assignedUid: d.assignedUid ?? null }, after: { status: patch.status ?? d.status, assignedUid: patch.assignedUid ?? d.assignedUid ?? null }, note,
  });
  if (patch.assignedUid && patch.assignedUid !== user.id && patch.assignedUid !== d.assignedUid) {
    notify(patch.assignedUid, { en: `Defect ${d.code} assigned to you`, ar: `تم إسناد العيب ${d.code} إليك` }, `/defects/${d.id}`);
  }
  syncInspection(d.inspectionId, { userAction: true }).catch(e => console.warn('sync after defect', e));
}

/** Returns every open defect held by a person to their discipline pool (hand-over when staff change). */
export async function releaseUserWork(admin: UserProfile, uid: string) {
  const snap = await getDocs(query(col('defects'), where('assignedUid', '==', uid)));
  let n = 0;
  for (const d of snap.docs) {
    const def = { id: d.id, ...d.data() } as Defect;
    if (def.status === 'closed') continue;
    await updateDoc(d.ref, { assignedUid: null, assignedName: null, status: def.status === 'assigned' ? 'open' : def.status, updatedAt: serverTimestamp() });
    n++;
  }
  audit(admin, 'user.handover', 'user', uid, { note: `${n} defects returned to pool` });
  return n;
}

/* ---------------- notifications ---------------- */
export function notify(toUid: string, title: { en: string; ar: string }, link: string) {
  return addDoc(col('notifications'), { toUid, title, link, read: false, createdAt: serverTimestamp() }).catch(() => {});
}
