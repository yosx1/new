/* When an inspection gets its final approval: notify management in the app and e-mail them the Excel results. */
import { getDoc } from 'firebase/firestore';
import { auth } from '../firebase';
import { ref } from './db';
import { notify } from './actions';
import { inspectionFileName, inspectionXlsx, type ExportCtx } from './inspectionExport';
import type { Inspection, Settings, UserProfile } from '../types';

export function reportRecipients(settings: Settings, users: UserProfile[]): UserProfile[] {
  const active = users.filter(u => u.active);
  const chosen = settings.reportRecipientUids ?? [];
  return chosen.length ? active.filter(u => chosen.includes(u.id)) : active.filter(u => u.role === 'manager' || u.role === 'admin');
}

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

export type EmailOutcome = 'sent' | 'notConfigured' | 'failed';

/** Sends the report e-mail through the relay. The relay re-checks everything with the caller's sign-in. */
export async function emailReport(settings: Settings, insp: Inspection, ctx: ExportCtx): Promise<EmailOutcome> {
  if (!settings.emailRelayUrl) return 'notConfigured';
  try {
    const idToken = await auth.currentUser!.getIdToken();
    const res = await fetch(settings.emailRelayUrl, {
      method: 'POST',
      // text/plain keeps this a "simple" request: Apps Script cannot answer CORS pre-flights.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ idToken, inspectionId: insp.id, lang: ctx.lang, fileName: inspectionFileName(insp), file: toBase64(inspectionXlsx(insp, ctx)) }),
    });
    const out = await res.json().catch(() => ({}));
    return out.ok ? 'sent' : 'failed';
  } catch { return 'failed'; }
}

/** Call right after a successful final approval. Reads the approved inspection back so the file shows the sign-off. */
export async function sendCompletionReport(me: UserProfile, settings: Settings, users: UserProfile[], inspId: string, ctx: ExportCtx): Promise<EmailOutcome> {
  const snap = await getDoc(ref('inspections', inspId));
  if (!snap.exists()) return 'failed';
  const insp = { id: snap.id, ...snap.data() } as Inspection;
  for (const u of reportRecipients(settings, users)) {
    if (u.id !== me.id) notify(u.id, { en: `${insp.title} (${insp.code}) is approved — results ready to export`, ar: `تم اعتماد فحص ${insp.title} (${insp.code}) — النتائج جاهزة للتصدير` }, `/inspections/${insp.id}`);
  }
  return emailReport(settings, insp, ctx);
}
