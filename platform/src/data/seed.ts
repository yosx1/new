/** Settings defaults and the four fixed departments of the cold run. */
import { doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { col } from '../lib/db';
import type { Settings, UserProfile } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  plantName: { en: 'Karbala Cement Plant', ar: 'معمل سمنت كربلاء' },
};

export const DEPARTMENTS = [
  ['RML1', 'Raw Mill 1', 'طاحونة المواد الأولية 1'],
  ['RML2', 'Raw Mill 2', 'طاحونة المواد الأولية 2'],
  ['KLN1', 'Kiln 1', 'الفرن 1'],
  ['KLN2', 'Kiln 2', 'الفرن 2'],
  ['CLR1', 'Cooler 1', 'المبرّد 1'],
  ['CLR2', 'Cooler 2', 'المبرّد 2'],
  ['CML1', 'Cement Mill 1', 'طاحونة السمنت 1'],
  ['CML2', 'Cement Mill 2', 'طاحونة السمنت 2'],
  ['CML3', 'Cement Mill 3', 'طاحونة السمنت 3'],
  ['CML4', 'Cement Mill 4', 'طاحونة السمنت 4'],
] as const;

/** First start only: creates the standard departments when there are none (afterwards the administrator manages them). */
export async function ensureDepartments(user: UserProfile) {
  if (!(await getDocs(col('departments'))).empty) return 0;
  const missing = DEPARTMENTS;
  const b = writeBatch(db);
  missing.forEach(([code, en, ar]) => b.set(doc(db, 'departments', code), {
    code, name: { en, ar }, order: DEPARTMENTS.findIndex(d => d[0] === code) + 1, active: true, createdAt: serverTimestamp(), createdBy: user.id,
  }));
  await b.commit();
  return missing.length;
}
