import { collection, doc, serverTimestamp, type DocumentData } from 'firebase/firestore';
import { addDoc, runTransaction } from './fs';
import { db } from '../firebase';
import type { UserProfile } from '../types';

export const col = (name: string) => collection(db, name);
export const ref = (path: string, ...segments: string[]) => doc(db, path, ...segments);

/** Append-only audit trail. Works offline (queued). Rules forbid updates and deletes. */
export function audit(
  user: UserProfile,
  action: string,
  entity: string,
  entityId: string,
  extra: { label?: string; before?: DocumentData | null; after?: DocumentData | null; note?: string } = {},
) {
  return addDoc(col('audit'), {
    action, entity, entityId,
    label: extra.label ?? '',
    before: extra.before ?? null,
    after: extra.after ?? null,
    note: extra.note ?? '',
    uid: user.id,
    userName: user.name,
    at: serverTimestamp(),
  }).catch(err => console.warn('audit failed', err));
}

/**
 * Human-readable sequential code like CR-2026-0042. Uses a counter transaction when online;
 * offline it falls back to a time-based code so field work is never blocked.
 */
export async function nextCode(prefix: 'CR' | 'DF'): Promise<string> {
  const year = new Date().getFullYear();
  if (navigator.onLine) {
    try {
      const n = await runTransaction(db, async tx => {
        const r = ref('counters', `${prefix}-${year}`);
        const snap = await tx.get(r);
        const next = (snap.exists() ? (snap.data().value as number) : 0) + 1;
        tx.set(r, { value: next, updatedAt: serverTimestamp() });
        return next;
      });
      return `${prefix}-${year}-${String(n).padStart(4, '0')}`;
    } catch (e) {
      console.warn('counter unavailable, using offline code', e);
    }
  }
  const t = Date.now().toString(36).toUpperCase().slice(-5);
  return `${prefix}-${year}-X${t}`;
}

export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T00:00:00');
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

export class ConflictError extends Error {
  constructor(public remote: DocumentData) { super('conflict'); }
}
