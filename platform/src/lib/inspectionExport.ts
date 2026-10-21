/* One inspection → Excel workbook (Summary, Parts, Approval). Used by the Export button
   and attached to the completion e-mail sent to management. */
import { buildXlsx, type Sheet } from './xlsx';
import type { Inspection, Lang } from '../types';

type TS = { toDate(): Date } | Date | string | null | undefined;
export interface ExportCtx { lang: Lang; deptName: string; plantName: string }

const when = (v: TS, lang: Lang) => {
  const d = !v ? null : typeof v === 'string' ? new Date(v) : v instanceof Date ? v : v.toDate();
  return d && !isNaN(+d) ? d.toLocaleString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
};

export function inspectionSheets(insp: Inspection, c: ExportCtx): Sheet[] {
  const L = (en: string, ar: string) => (c.lang === 'en' ? en : ar);
  const DISC: Record<string, [string, string]> = {
    mechanical: ['Mechanical', 'ميكانيك'], electrical: ['Electrical', 'كهرباء'],
    instrumentation: ['Instrumentation & Control', 'السيطرة والأجهزة'], production: ['Production', 'الإنتاج'],
  };
  const ST: Record<string, [string, string]> = {
    pool: ['Waiting in pool', 'بانتظار الفريق'], corrective: ['Corrective maintenance', 'صيانة تصحيحية'],
    waiting_approval: ['Waiting approval', 'بانتظار الموافقة'], approved: ['Approved', 'معتمد'], archived: ['Done', 'منجز'],
  };
  const s = insp.summary;
  const title = [`${insp.title} · ${insp.code}`, `${c.plantName} · ${insp.shutdownName} · ${L('Exported', 'تاريخ التصدير')} ${when(new Date(), c.lang)}`];
  const summary: Sheet = {
    name: L('Summary', 'الملخص'), title, header: [L('Field', 'الحقل'), L('Value', 'القيمة')],
    rows: [
      [L('Inspection ID', 'رقم الفحص'), insp.code],
      [L('Equipment', 'المعدة'), insp.title],
      [L('Department', 'القسم'), c.deptName],
      [L('Discipline', 'الاختصاص'), L(...(DISC[insp.discipline] ?? [insp.discipline, insp.discipline]))],
      [L('Shutdown', 'التوقف السنوي'), insp.shutdownName],
      [L('Status', 'الحالة'), L(...(ST[insp.status] ?? [insp.status, insp.status]))],
      [L('Started by', 'بدأه'), insp.createdByName],
      [L('Parts', 'الأجزاء'), s.total],
      [L('OK', 'سليم'), s.ok],
      [L('Not OK', 'غير سليم'), s.notok],
      [L('Fixed', 'تم الإصلاح'), s.fixed],
      [L('Not checked', 'لم يُفحص'), s.pending],
      [L('Approved by', 'اعتمده'), insp.approval?.byName ?? ''],
      [L('Approved at', 'وقت الاعتماد'), when(insp.approval?.at, c.lang)],
      ...(insp.approval?.comment ? [[L('Approval comment', 'ملاحظة الاعتماد'), insp.approval.comment] as [string, string]] : []),
    ],
  };
  const res: Record<string, [string, string]> = { ok: ['OK', 'سليم'], notok: ['Not OK', 'غير سليم'], pending: ['Not checked', 'لم يُفحص'] };
  const parts: Sheet = {
    name: L('Parts', 'الأجزاء'), title,
    header: ['#', L('Part', 'الجزء'), L('Result', 'النتيجة'), L('Problem', 'المشكلة'), L('Checked by', 'فحصه'), L('Time', 'الوقت'),
      L('Corrective maintenance', 'الصيانة التصحيحية'), L('Fixed by', 'أصلحه'), L('Fixed at', 'وقت الإصلاح')],
    rows: insp.parts.map((p, k) => {
      const r = insp.results[p.id];
      return [k + 1, p.name, L(...(res[r?.status ?? 'pending'])), r?.status === 'notok' ? r.note : '', r?.byName ?? '', when(r?.at, c.lang),
        r?.fix?.note ?? '', r?.fix?.byName ?? '', when(r?.fix?.at, c.lang)];
    }),
  };
  return [summary, parts];
}

export const inspectionFileName = (insp: Inspection) => `${insp.code} ${insp.title}.xlsx`.replace(/[\\/:*?"<>|]/g, '-');
export const inspectionXlsx = (insp: Inspection, c: ExportCtx) => buildXlsx(inspectionSheets(insp, c), c.lang === 'ar');
