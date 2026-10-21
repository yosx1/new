/** Settings defaults and the four fixed departments of the cold run. */
import { doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { col } from '../lib/db';
import type { Settings, UserProfile } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  plantName: { en: 'Karbala Cement Plant', ar: 'معمل سمنت كربلاء' },
};

export const DEPARTMENTS = [
  ['RML', 'Raw Mill', 'طاحونة المواد الأولية'],
  ['KLN', 'Kiln', 'الفرن'],
  ['CLR', 'Cooler', 'المبرّد'],
  ['CML', 'Cement Mill', 'طاحونة السمنت'],
] as const;

/** Creates any missing department (administrator, once). */
export async function ensureDepartments(user: UserProfile) {
  const have = new Set((await getDocs(col('departments'))).docs.map(d => d.id));
  const missing = DEPARTMENTS.filter(([code]) => !have.has(code));
  if (!missing.length) return 0;
  const b = writeBatch(db);
  missing.forEach(([code, en, ar]) => b.set(doc(db, 'departments', code), {
    code, name: { en, ar }, order: DEPARTMENTS.findIndex(d => d[0] === code) + 1, active: true, createdAt: serverTimestamp(), createdBy: user.id,
  }));
  await b.commit();
  return missing.length;
}
