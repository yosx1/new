/* Equipment list as CSV: one row per part — Department, Equipment, Part type, Part. */
import { toCsv } from './files';
import { parseCsv } from './csv';
import { DISCIPLINES, type Department, type Discipline, type Equipment } from '../types';

export const CSV_HEADER = ['Department', 'Equipment', 'Part type', 'Part'];
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
    for (const d of DISCIPLINES) for (const p of e.parts?.[d] ?? []) { rows.push([dName(e.departmentId), e.name, LABEL[d], p]); any = true; }
    if (!any) rows.push([dName(e.departmentId), e.name, '', '']);
  }
  if (!rows.length) {
    rows.push(['Raw Mill', 'Raw mill main drive', 'Mechanical', 'Gearbox'], ['Raw Mill', 'Raw mill main drive', 'Mechanical', 'Coupling'],
      ['Raw Mill', 'Raw mill main drive', 'Electrical', 'Main motor'], ['Raw Mill', 'Raw mill main drive', 'Electrical', 'MCC panel'],
      ['Raw Mill', 'Raw mill main drive', 'Instrumentation', 'Bearing temperature sensors'], ['Raw Mill', 'Raw mill main drive', 'Production', 'Local control station']);
  }
  return toCsv([CSV_HEADER, ...rows]);
}

export interface CsvPlan {
  /** key = existing equipment id or "new:<dept>|<name>" */
  items: { id: string | null; departmentId: string; name: string; parts: Record<Discipline, string[]> }[];
  errors: { line: number; text: string; reason: 'dept' | 'name' | 'type' }[];
  added: number; updated: number; parts: number;
}

/** Equipment named in the file get exactly the parts listed for them; equipment not in the file are left alone. */
export function planCsvImport(text: string, equipment: Equipment[], depts: Department[]): CsvPlan {
  const rows = parseCsv(text);
  const head = rows[0]?.map(norm) ?? [];
  const hasHeader = head.includes('equipment') || head.includes('المعدة') || head.includes('department');
  const body = hasHeader ? rows.slice(1) : rows;
  const deptOf = (s: string) => { const n = norm(s); return depts.find(d => [d.id, d.code, d.name.en, d.name.ar].some(x => norm(x) === n)); };
  const typeOf = (s: string) => DISCIPLINES.find(d => TYPE_NAMES[d].includes(norm(s)));
  const plan = new Map<string, CsvPlan['items'][number]>();
  const errors: CsvPlan['errors'] = [];
  body.forEach((r, k) => {
    const [dept = '', name = '', type = '', part = ''] = r;
    const line = k + (hasHeader ? 2 : 1);
    const d = deptOf(dept);
    if (!d) { errors.push({ line, text: r.join(' | '), reason: 'dept' }); return; }
    if (!name) { errors.push({ line, text: r.join(' | '), reason: 'name' }); return; }
    const disc = type ? typeOf(type) : undefined;
    if (part && !disc) { errors.push({ line, text: r.join(' | '), reason: 'type' }); return; }
    const key = `${d.id}|${norm(name)}`;
    if (!plan.has(key)) {
      const ex = equipment.find(e => e.departmentId === d.id && norm(e.name) === norm(name));
      plan.set(key, { id: ex?.id ?? null, departmentId: d.id, name: ex?.name ?? name.trim(), parts: { mechanical: [], electrical: [], instrumentation: [], production: [] } });
    }
    if (part && disc) { const list = plan.get(key)!.parts[disc]; if (!list.includes(part)) list.push(part); }
  });
  const items = [...plan.values()];
  return { items, errors, added: items.filter(i => !i.id).length, updated: items.filter(i => i.id).length,
    parts: items.reduce((n, i) => n + DISCIPLINES.reduce((m, d) => m + i.parts[d].length, 0), 0) };
}
