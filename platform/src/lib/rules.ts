/**
 * Business rules: who may do what, inspection summaries and status. The same rules are enforced
 * server-side in firestore.rules where they protect data.
 */
import type { Discipline, Equipment, Inspection, InspectionStatus, InspectionSummary, PartResult, UserProfile } from '../types';
import { DISCIPLINES } from '../types';

export const isLead = (u: UserProfile) => u.role === 'admin' || u.role === 'manager';

/** Departments a person works in (null = every department). */
const inDept = (u: UserProfile, departmentId: string) => !u.departmentId || u.departmentId === departmentId;

export const can = {
  manageSystem: (u: UserProfile) => u.role === 'admin',
  manageEquipment: (u: UserProfile) => isLead(u),
  approve: (u: UserProfile) => isLead(u),
  archive: (u: UserProfile) => isLead(u),
  seeAudit: (u: UserProfile) => isLead(u),
  /** Disciplines this person may start inspections for on a piece of equipment. */
  disciplinesFor: (u: UserProfile, e: Equipment): Discipline[] =>
    DISCIPLINES.filter(d => (e.parts?.[d]?.length ?? 0) > 0
      && (isLead(u) || (u.role === 'member' && u.discipline === d && inDept(u, e.departmentId)))),
  /** Fill in / fix the parts of an inspection. */
  work: (u: UserProfile, i: Pick<Inspection, 'discipline' | 'departmentId' | 'status'>) =>
    (i.status === 'pool' || i.status === 'corrective')
    && (isLead(u) || (u.role === 'member' && u.discipline === i.discipline && inDept(u, i.departmentId))),
};

/** The team pool: inspections waiting for this person's discipline (and department). */
export const inMyPool = (u: UserProfile, i: Inspection) =>
  (i.status === 'pool' || i.status === 'corrective') && u.role === 'member'
  && u.discipline === i.discipline && inDept(u, i.departmentId);

export function summarize(parts: { id: string }[], results: Record<string, PartResult>): InspectionSummary {
  const s: InspectionSummary = { total: parts.length, ok: 0, notok: 0, fixed: 0, pending: 0 };
  for (const p of parts) {
    const r = results[p.id];
    if (!r || r.status === 'pending') s.pending++;
    else if (r.status === 'ok') s.ok++;
    else { s.notok++; if (r.fix) s.fixed++; }
  }
  return s;
}

/** Status after the team submits: open "Not OK" parts mean corrective maintenance first. */
export const statusAfterWork = (s: InspectionSummary): InspectionStatus =>
  s.pending > 0 ? 'pool' : s.notok > s.fixed ? 'corrective' : 'waiting_approval';

export const STATUS_TONE: Record<InspectionStatus, 'gray' | 'blue' | 'orange' | 'red' | 'green' | 'purple'> = {
  pool: 'blue',
  corrective: 'red',
  waiting_approval: 'purple',
  approved: 'green',
  archived: 'gray',
};

export const completion = (s: InspectionSummary) => (s.total ? Math.round(((s.total - s.pending) / s.total) * 100) : 0);

/** Deterministic id: one inspection per equipment and discipline in each shutdown. */
export const inspectionId = (shutdownId: string, equipmentId: string, d: Discipline) => `${shutdownId}_${equipmentId}_${d}`;
