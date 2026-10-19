import type { FilterState } from '../components/Filters';
import type { Defect, Inspection } from '../types';

const norm = (s: string) => s.toLowerCase().normalize('NFKD');

export function filterInspections(list: Inspection[], f: FilterState, defects: Defect[] = []) {
  const q = norm(f.q.trim());
  const defectHits = q ? new Set(defects.filter(d => norm(d.code).includes(q)).map(d => d.inspectionId)) : null;
  return list.filter(i => {
    if (f.dept && i.departmentId !== f.dept) return false;
    if (f.eq && i.equipmentId !== f.eq) return false;
    if (f.status && i.status !== f.status) return false;
    if (f.from && i.inspectionDate < f.from) return false;
    if (f.to && i.inspectionDate > f.to) return false;
    if (f.disc && !i.checklist.some(s => s.discipline === f.disc)) return false;
    if (q) {
      const hay = norm([i.code, i.title, i.workOrder, i.equipmentTag, i.equipmentName.en, i.equipmentName.ar,
        i.maintenanceType, i.createdByName, i.inspectionDate, i.status].join(' '));
      if (!hay.includes(q) && !defectHits!.has(i.id)) return false;
    }
    return true;
  });
}

export function filterDefects(list: Defect[], f: FilterState) {
  const q = norm(f.q.trim());
  return list.filter(d => {
    if (f.dept && d.departmentId !== f.dept) return false;
    if (f.eq && d.equipmentId !== f.eq) return false;
    if (f.disc && d.pool !== f.disc) return false;
    if (f.status && d.status !== f.status) return false;
    const day = d.reportedAt?.toDate?.().toISOString().slice(0, 10) ?? '';
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (q) {
      const hay = norm([d.code, d.inspectionCode, d.equipmentTag, d.description, d.itemLabel.en, d.itemLabel.ar, d.assignedName ?? '', d.correctiveAction ?? ''].join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Defects on the same equipment item that occurred more than once = recurring failure. */
export function recurringKeys(defects: Defect[]) {
  const count = new Map<string, number>();
  for (const d of defects) count.set(d.equipmentId + '|' + d.itemId, (count.get(d.equipmentId + '|' + d.itemId) ?? 0) + 1);
  return new Set([...count].filter(([, n]) => n > 1).map(([k]) => k));
}
