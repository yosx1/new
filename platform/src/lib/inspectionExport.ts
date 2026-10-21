/* One inspection → Excel workbook (Summary, Results, Defects, Approvals). Used by the Export button,
   and attached to the completion e-mail sent to management. */
import { buildXlsx, type Sheet } from './xlsx';
import type { Bilingual, Defect, Inspection, ItemResult, Lang } from '../types';

type TS = { toDate(): Date } | Date | string | null | undefined;
export interface ExportCtx { lang: Lang; deptName: string; plantName: string }

const when = (v: TS, lang: Lang) => {
  const d = !v ? null : typeof v === 'string' ? new Date(v) : v instanceof Date ? v : v.toDate();
  return d && !isNaN(+d) ? d.toLocaleString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
};

export function inspectionSheets(insp: Inspection, results: Record<string, ItemResult>, defects: Defect[], c: ExportCtx): Sheet[] {
  const L = (en: string, ar: string) => (c.lang === 'en' ? en : ar);
  const bi = (v?: Bilingual | null) => (v ? (c.lang === 'en' ? v.en || v.ar : v.ar || v.en) : '');
  const DISC: Record<string, [string, string]> = {
    mechanical: ['Mechanical', 'ميكانيك'], electrical: ['Electrical', 'كهرباء'], instrumentation: ['Instrumentation', 'سيطرة وأجهزة دقيقة'],
    production: ['Production', 'إنتاج'], final: ['Final approval', 'الموافقة النهائية'],
  };
  const disc = (d: string) => (DISC[d] ? L(...DISC[d]) : d);
  const RES: Record<string, [string, string]> = { pass: ['Pass', 'مطابق'], fail: ['Fail', 'غير مطابق'], na: ['N/A', 'لا ينطبق'], pending: ['Pending', 'قيد الانتظار'] };
  const SEV: Record<string, [string, string]> = { critical: ['Critical', 'حرج'], high: ['High', 'عالي'], medium: ['Medium', 'متوسط'], low: ['Low', 'منخفض'] };
  const s = insp.summary;
  const pct = s.total ? Math.round(((s.pass + s.fail + s.na) / s.total) * 100) : 0;
  const title = [`${insp.equipmentTag} · ${insp.code}`, `${c.plantName} · ${L('Exported', 'تاريخ التصدير')} ${when(new Date(), c.lang)}`];

  const summary: Sheet = {
    name: L('Summary', 'الملخص'), title, header: [L('Field', 'الحقل'), L('Value', 'القيمة')],
    rows: [
      [L('Inspection ID', 'رقم الفحص'), insp.code],
      [L('Title', 'العنوان'), insp.title],
      [L('Equipment', 'المعدة'), `${insp.equipmentTag} – ${bi(insp.equipmentName)}`],
      [L('Department', 'القسم'), c.deptName],
      [L('Work order', 'أمر العمل'), insp.workOrder],
      [L('Maintenance type', 'نوع الصيانة'), insp.maintenanceType],
      [L('Maintenance completed', 'تاريخ إنجاز الصيانة'), insp.maintenanceCompletedAt],
      [L('Inspection date', 'تاريخ الفحص'), insp.inspectionDate],
      [L('Shift', 'الوجبة'), insp.shift],
      [L('Checklist', 'قائمة الفحص'), `${insp.templateCode} v${insp.templateVersion} – ${bi(insp.templateName)}`],
      [L('Status', 'الحالة'), insp.status === 'approved' ? L('Approved', 'تمت الموافقة') : insp.status],
      [L('Items', 'البنود'), s.total],
      [L('Pass', 'مطابق'), s.pass],
      [L('Fail', 'غير مطابق'), s.fail],
      [L('N/A', 'لا ينطبق'), s.na],
      [L('Pending', 'قيد الانتظار'), s.pending],
      [L('Completion %', 'نسبة الإنجاز %'), pct],
      [L('Open defects', 'العيوب المفتوحة'), s.openDefects],
      [L('Final approval by', 'الموافقة النهائية بواسطة'), insp.approvals.final?.byName ?? ''],
      [L('Final approval at', 'وقت الموافقة النهائية'), when(insp.approvals.final?.at, c.lang)],
      ...(insp.override ? [[L('Override justification', 'مبرر التجاوز'), insp.override.justification] as [string, string]] : []),
      ...(insp.remarks ? [[L('Remarks', 'ملاحظات'), insp.remarks] as [string, string]] : []),
    ],
  };

  const resultRows = insp.checklist.flatMap(sec => sec.items.map(item => {
    const r = results[item.id];
    const lim = item.measure ? [item.measure.min, item.measure.max].map(x => (x == null ? '' : x)).join(' – ') : '';
    return [bi(sec.title), disc(sec.discipline), bi(item.label), item.critical ? L('Yes', 'نعم') : '', L(...(RES[r?.status ?? 'pending'] ?? RES.pending)),
      r?.value ?? '', item.measure?.unit ?? '', lim, r?.comment || r?.naReason || '', r?.inspectorName ?? '', when(r?.at, c.lang)];
  }));
  const results_: Sheet = {
    name: L('Results', 'النتائج'), title,
    header: [L('Section', 'القسم'), L('Discipline', 'الاختصاص'), L('Item', 'البند'), L('Critical', 'حرج'), L('Result', 'النتيجة'),
      L('Reading', 'القراءة'), L('Unit', 'الوحدة'), L('Limits', 'الحدود'), L('Comment', 'ملاحظة'), L('Inspector', 'الفاحص'), L('Time', 'الوقت')],
    rows: resultRows,
  };

  const defs: Sheet = {
    name: L('Defects', 'العيوب'), title,
    header: [L('Defect', 'العيب'), L('Item', 'البند'), L('Severity', 'الخطورة'), L('Discipline', 'الاختصاص'), L('Description', 'الوصف'),
      L('Assigned to', 'مسند إلى'), L('Target date', 'التاريخ المستهدف'), L('Status', 'الحالة'), L('Repaired by', 'أصلحه'), L('Verified by', 'تحقق منه')],
    rows: defects.map(d => [d.code, bi(d.itemLabel), L(...(SEV[d.severity] ?? [d.severity, d.severity])), disc(d.pool), d.description,
      d.assignedName ?? '', d.targetDate, d.status, d.repair?.byName ?? '', d.verification?.byName ?? '']),
  };

  const appr: Sheet = {
    name: L('Approvals', 'الموافقات'), title,
    header: [L('Sign-off', 'التوقيع'), L('Decision', 'القرار'), L('By', 'بواسطة'), L('Time', 'الوقت'), L('Comment', 'ملاحظة')],
    rows: [...insp.requiredApprovals, 'final' as const].map(k => {
      const a = insp.approvals[k];
      return [disc(k), a ? (a.decision === 'approved' ? L('Approved', 'موافقة') : L('Rejected', 'رفض')) : L('Pending', 'قيد الانتظار'), a?.byName ?? '', when(a?.at, c.lang), a?.comment ?? ''];
    }),
  };
  return [summary, results_, defs, appr];
}

export const inspectionFileName = (insp: Inspection) => `${insp.code} ${insp.equipmentTag}.xlsx`.replace(/[\\/:*?"<>|]/g, '-');
export const inspectionXlsx = (insp: Inspection, results: Record<string, ItemResult>, defects: Defect[], c: ExportCtx) =>
  buildXlsx(inspectionSheets(insp, results, defects, c), c.lang === 'ar');
