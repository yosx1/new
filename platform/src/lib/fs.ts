/**
 * Metered Firestore calls. The free (Spark) plan gives Google's usage numbers only to projects with billing,
 * so the app counts its own document reads, writes and deletes (as Firestore bills them, rounded up) and adds
 * them to usage/{day} every 10–15 minutes. The e-mail service compares that day's total with the free limits and
 * alerts the administrators. Same signatures as 'firebase/firestore': import these instead of the originals.
 */
import * as F from 'firebase/firestore';
import { db } from '../firebase';

/** Free daily limits of the Spark plan; they reset at midnight Pacific time. */
export const FREE_DAILY = { reads: 50000, writes: 20000, deletes: 20000 } as const;
type Kind = keyof typeof FREE_DAILY;

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
/** The quota day (Pacific time) as YYYY-MM-DD. */
export const usageDay = () => dayFmt.format(new Date());

const pending = new Map<string, Record<Kind, number>>();
const trace: string[] = [];
if (import.meta.env.VITE_USE_EMULATORS) (window as unknown as { __meter: unknown }).__meter = { pending, trace };
function add(kind: Kind, n = 1, why = '') {
  if (import.meta.env.VITE_USE_EMULATORS) trace.push(kind + ' ' + n + ' ' + why);
  if (n <= 0) return;
  const day = usageDay();
  const c = pending.get(day) ?? { reads: 0, writes: 0, deletes: 0 };
  c[kind] += n;
  pending.set(day, c);
}

let flushing = false, lastFlush = 0; // the first hide of a session always reports
async function flush(force = true) {
  if (flushing || !pending.size) return;
  const waiting = [...pending.values()].reduce((n, c) => n + c.reads + c.writes + c.deletes, 0);
  // each report is a write too, so it is sent at most every 10 minutes unless a lot is waiting
  if (!force && Date.now() - lastFlush < 10 * 60 * 1000 && waiting < 2000) return;
  flushing = true;
  lastFlush = Date.now();
  const batch = [...pending.entries()];
  pending.clear();
  try {
    for (const [day, c] of batch) {
      // the report itself is one more write
      await F.setDoc(F.doc(db, 'usage', day), {
        reads: F.increment(c.reads), writes: F.increment(c.writes + 1), deletes: F.increment(c.deletes), updatedAt: F.serverTimestamp(),
      }, { merge: true });
    }
  } catch {
    // signed out or not allowed: put the counts back for the next try
    for (const [day, c] of batch) {
      const p = pending.get(day) ?? { reads: 0, writes: 0, deletes: 0 };
      (Object.keys(c) as Kind[]).forEach(k => { p[k] += c[k]; });
      pending.set(day, p);
    }
  } finally { flushing = false; }
}

/** Sends the counts now (before signing out). */
export const flushUsage = () => flush(true);

let started = false;
/** Starts sending the counts (every 5 minutes and when the app is hidden). Call once a user is signed in. */
export function startMeter() {
  if (started) return;
  started = true;
  seen();
  setInterval(seen, 60 * 1000);
  setInterval(() => void flush(), 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush(false); });
}

/* ---------------- writes ---------------- */

export const setDoc = ((...a: Parameters<typeof F.setDoc>) => { add('writes'); return F.setDoc(...a); }) as typeof F.setDoc;
export const updateDoc = ((...a: unknown[]) => { add('writes'); return (F.updateDoc as (...x: unknown[]) => Promise<void>)(...a); }) as typeof F.updateDoc;
export const addDoc = ((...a: Parameters<typeof F.addDoc>) => { add('writes'); return F.addDoc(...a); }) as typeof F.addDoc;
export const deleteDoc = ((...a: Parameters<typeof F.deleteDoc>) => { add('deletes'); return F.deleteDoc(...a); }) as typeof F.deleteDoc;

/** A write batch that counts its operations when it is committed. */
export function writeBatch(firestore: F.Firestore): F.WriteBatch {
  const b = F.writeBatch(firestore);
  let w = 0, d = 0;
  const proxy: F.WriteBatch = {
    set: ((...a: unknown[]) => { w++; (b.set as (...x: unknown[]) => unknown)(...a); return proxy; }) as F.WriteBatch['set'],
    update: ((...a: unknown[]) => { w++; (b.update as (...x: unknown[]) => unknown)(...a); return proxy; }) as F.WriteBatch['update'],
    delete: (r => { d++; b.delete(r); return proxy; }) as F.WriteBatch['delete'],
    commit: () => { add('writes', w); add('deletes', d); return b.commit(); },
  } as F.WriteBatch;
  return proxy;
}

/** A transaction that counts every read (each attempt is billed) and the writes of the attempt that succeeds. */
export function runTransaction<T>(firestore: F.Firestore, fn: (t: F.Transaction) => Promise<T>, options?: F.TransactionOptions): Promise<T> {
  let w = 0, d = 0;
  return F.runTransaction(firestore, tx => {
    w = 0; d = 0;
    const proxy: F.Transaction = {
      get: (r => { add('reads'); return tx.get(r); }) as F.Transaction['get'],
      set: ((...a: unknown[]) => { w++; (tx.set as (...x: unknown[]) => unknown)(...a); return proxy; }) as F.Transaction['set'],
      update: ((...a: unknown[]) => { w++; (tx.update as (...x: unknown[]) => unknown)(...a); return proxy; }) as F.Transaction['update'],
      delete: (r => { d++; tx.delete(r); return proxy; }) as F.Transaction['delete'],
    } as F.Transaction;
    return fn(proxy);
  }, options).then(v => { add('writes', w); add('deletes', d); return v; });
}

/* ---------------- reads ---------------- */

export const getDoc = (async (r: F.DocumentReference) => { const s = await F.getDoc(r); if (!s.metadata.fromCache) add('reads'); return s; }) as typeof F.getDoc;
export const getDocs = (async (q: F.Query) => { const s = await F.getDocs(q); if (!s.metadata.fromCache) add('reads', Math.max(1, s.size)); return s; }) as typeof F.getDocs;

// Firestore bills a listener in full again when the app was away for more than 30 minutes; within that, only what changed.
/** Counting with an aggregation costs one read per 1000 documents counted. */
export const getCountFromServer = (async (q: F.Query) => { const s = await F.getCountFromServer(q); add('reads', Math.max(1, Math.ceil(s.data().count / 1000))); return s; }) as typeof F.getCountFromServer;

const RESUME_MS = 30 * 60 * 1000;
const SEEN = 'meterSeen';
const cold = (() => { try { return Date.now() - Number(localStorage.getItem(SEEN) || 0) > RESUME_MS; } catch { return true; } })();
const seen = () => { try { if (document.visibilityState === 'visible') localStorage.setItem(SEEN, String(Date.now())); } catch { /* private mode */ } };

/** Live listeners: the first answer counts every document (unless the app was open a moment ago), later answers count what changed. */
export const onSnapshot = ((ref: unknown, ...args: unknown[]) => {
  let first = true;
  const count = (snap: F.DocumentSnapshot | F.QuerySnapshot) => {
    const m = snap.metadata;
    const size = 'docChanges' in snap ? Math.max(1, snap.size) : 1;
    if (first) { first = false; if (!m.fromCache || cold) add('reads', size, 'first'); return; }
    if (m.fromCache || m.hasPendingWrites) return; // offline, or this device's own change
    add('reads', 'docChanges' in snap ? snap.docChanges().length : 1, 'change');
  };
  const k = args.findIndex(x => typeof x === 'function' || (x && typeof x === 'object' && 'next' in (x as object)));
  if (k >= 0) {
    const h = args[k];
    if (typeof h === 'function') args[k] = (s: F.DocumentSnapshot | F.QuerySnapshot) => { count(s); (h as (s: unknown) => void)(s); };
    else {
      const o = h as { next?: (s: unknown) => void };
      args[k] = { ...o, next: (s: F.DocumentSnapshot | F.QuerySnapshot) => { count(s); o.next?.(s); } };
    }
  }
  return (F.onSnapshot as (...x: unknown[]) => F.Unsubscribe)(ref, ...args);
}) as typeof F.onSnapshot;
