/* Equipment list as CSV: one row per checklist item — Department, Code, Equipment, Part type, Part.
   Files without the Code column (the earlier format) are still accepted. */
import { toCsv } from './files';
import { parseCsv } from './csv';
import { DISCIPLINES, type Department, type Discipline, type Equipment } from '../types';

export const CSV_HEADER = ['Department', 'Code', 'Equipment', 'Part type', 'Part'];
const TYPE_NAMES: Record<Discipline, string[]> = {
  mechanical: ['mechanical', 'mech', 'm', 'ميكانيك', 'ميكانيكي', 'ميكانيكية'],
  electrical: ['electrical', 'elec', 'e', 'كهرباء', 'كهربائي', 'كهربائية'],
  instrumentation: ['instrumentation', 'instrument', 'i', 'i&c', 'سيطرة', 'السيطرة', 'أجهزة دقيقة', 'السيطرة والأجهزة'],
  production: ['production', 'prod', 'p', 'إنتاج', 'الإنتاج', 'انتاج'],
};
const LABEL: Record<Discipline, string> = { mechanical: 'Mechanical', electrical: 'Electrical', instrumentation: 'Instrumentation', production: 'Production' };
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function equipmentToCsv(equipment: Equipment[], depts: Department[]): string {
  const dName = (id: string) => depts.find(d => d.id === id)?.name.en ?? id;
  const rows: string[][] = [];
  for (const e of equipment.filter(x => x.active)) {
    let any = false;
    for (const d of DISCIPLINES) for (const p of e.parts?.[d] ?? []) { rows.push([dName(e.departmentId), e.code ?? '', e.name, LABEL[d], p]); any = true; }
    if (!any) rows.push([dName(e.departmentId), e.code ?? '', e.name, '', '']);
  }
  if (!rows.length) {
    rows.push(['Raw Mill 1', 'E1M011', 'Raw Mill main drive', 'Mechanical', 'Coupling alignment checked and coupling guard fitted'],
      ['Raw Mill 1', 'E1M011', 'Raw Mill main drive', 'Electrical', 'Motor insulation resistance (megger) measured and recorded'],
      ['Raw Mill 1', 'E1M011', 'Raw Mill main drive', 'Instrumentation', 'Bearing temperature signals in CCR'],
      ['Raw Mill 1', 'E1M011', 'Raw Mill main drive', 'Production', 'Start / stop from CCR checked and running signal received']);
  }
  return toCsv([CSV_HEADER, ...rows]);
}

export interface CsvPlan {
  /** key = existing equipment id or "new:<dept>|<name>" */
  items: { id: string | null; code: string; departmentId: string; name: string; parts: Record<Discipline, string[]> }[];
  errors: { line: number; text: string; reason: 'dept' | 'name' | 'type' | 'code' }[];
  added: number; updated: number; parts: number;
}

/** Equipment named in the file get exactly the parts listed for them; equipment not in the file are left alone. */
export function planCsvImport(text: string, equipment: Equipment[], depts: Department[]): CsvPlan {
  const rows = parseCsv(text);
  const head = rows[0]?.map(norm) ?? [];
  const hasHeader = head.includes('equipment') || head.includes('المعدة') || head.includes('department');
  // with a Code column: Department, Code, Equipment, Part type, Part
  const withCode = hasHeader ? (head.includes('code') || head.includes('الرمز') || head.includes('الكود')) : (rows[0]?.length ?? 0) >= 5;
  const body = hasHeader ? rows.slice(1) : rows;
  const codeOwner = new Map<string, string>();
  const deptOf = (s: string) => { const n = norm(s); return depts.find(d => [d.id, d.code, d.name.en, d.name.ar].some(x => norm(x) === n)); };
  const typeOf = (s: string) => DISCIPLINES.find(d => TYPE_NAMES[d].includes(norm(s)));
  const plan = new Map<string, CsvPlan['items'][number]>();
  const errors: CsvPlan['errors'] = [];
  body.forEach((r, k) => {
    const [dept = '', code = '', name = '', type = '', part = ''] = withCode ? r : [r[0], '', r[1], r[2], r[3]];
    const line = k + (hasHeader ? 2 : 1);
    const d = deptOf(dept);
    if (!d) { errors.push({ line, text: r.join(' | '), reason: 'dept' }); return; }
    if (!name) { errors.push({ line, text: r.join(' | '), reason: 'name' }); return; }
    const c = code.trim().toUpperCase();
    if (c.length > 40) { errors.push({ line, text: r.join(' | '), reason: 'code' }); return; }
    const disc = type ? typeOf(type) : undefined;
    if (part && !disc) { errors.push({ line, text: r.join(' | '), reason: 'type' }); return; }
    // the code identifies the equipment; without one, the department + name does
    const key = c ? `code|${c}` : `${d.id}|${norm(name)}`;
    if (c && codeOwner.has(c) && codeOwner.get(c) !== `${d.id}|${norm(name)}`) { errors.push({ line, text: r.join(' | '), reason: 'code' }); return; }
    if (c) codeOwner.set(c, `${d.id}|${norm(name)}`);
    if (!plan.has(key)) {
      const ex = c ? equipment.find(e => (e.code ?? '').toUpperCase() === c)
        : equipment.find(e => !e.code && e.departmentId === d.id && norm(e.name) === norm(name));
      plan.set(key, { id: ex?.id ?? null, code: c, departmentId: d.id, name: name.trim().replace(/\s+/g, ' '), parts: { mechanical: [], electrical: [], instrumentation: [], production: [] } });
    }
    if (part && disc) { const list = plan.get(key)!.parts[disc]; if (!list.includes(part)) list.push(part); }
  });
  const items = [...plan.values()];
  return { items, errors, added: items.filter(i => !i.id).length, updated: items.filter(i => i.id).length,
    parts: items.reduce((n, i) => n + DISCIPLINES.reduce((m, d) => m + i.parts[d].length, 0), 0) };
}
