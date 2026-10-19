/**
 * Business rules: permissions, inspection status derivation, readiness and task pools.
 * The same rules are enforced server-side in firestore.rules where they protect data.
 */
import type {
  Defect, Discipline, Inspection, InspectionStatus, InspectionSummary, ItemResult,
  Role, Settings, UserProfile, ChecklistSection,
} from '../types';
import { DISCIPLINES } from '../types';

export const OPEN_DEFECT = (d: Defect) => d.status !== 'closed';

export function disciplineOf(role: Role): Discipline | null {
  return (DISCIPLINES as string[]).includes(role) ? (role as Discipline) : null;
}

export const can = {
  manageSystem: (u: UserProfile) => u.role === 'admin',
  createInspection: (u: UserProfile) => ['admin', 'supervisor', 'manager'].includes(u.role),
  seeAll: (u: UserProfile) => ['admin', 'supervisor', 'manager', 'viewer'].includes(u.role),
  executeSection: (u: UserProfile, s: ChecklistSection) =>
    u.role === s.discipline || u.role === 'supervisor' || u.role === 'admin',
  approveDiscipline: (u: UserProfile, d: Discipline, insp?: Inspection) =>
    (u.role === d || u.role === 'manager' || u.role === 'admin') && inScope(u, insp),
  finalApprove: (u: UserProfile, insp?: Inspection) => ['supervisor', 'manager', 'admin'].includes(u.role) && inScope(u, insp),
  override: (u: UserProfile, s: Settings) => s.overrideRoles.includes(u.role),
  workDefect: (u: UserProfile, d: Defect) => u.role === d.pool || ['supervisor', 'admin'].includes(u.role),
  assignDefect: (u: UserProfile) => ['supervisor', 'manager', 'admin'].includes(u.role),
  verifyDefect: (u: UserProfile, d: Defect) =>
    ['supervisor', 'manager', 'admin'].includes(u.role) && d.repair?.by !== u.id,
  reopen: (u: UserProfile) => ['supervisor', 'manager', 'admin'].includes(u.role),
  seeAudit: (u: UserProfile) => ['admin', 'manager', 'supervisor'].includes(u.role),
};

/** Managers/supervisors bound to a department may only approve that department's records. */
function inScope(u: UserProfile, insp?: Inspection) {
  if (!insp || !u.departmentId || u.role === 'admin') return true;
  if (u.role === 'manager' || u.role === 'supervisor') return insp.departmentId === u.departmentId;
  return true;
}

export function computeSummary(checklist: ChecklistSection[], results: Record<string, ItemResult>, defects: Defect[]): InspectionSummary {
  const s: InspectionSummary = {
    total: 0, pass: 0, fail: 0, pending: 0, na: 0, mandatoryPending: 0, criticalFail: 0,
    openDefects: 0, openCritical: 0, awaitingVerification: 0, sections: {},
  };
  for (const sec of checklist) {
    const ss = { done: 0, total: sec.items.length, fail: 0 };
    for (const it of sec.items) {
      s.total++;
      const st = results[it.id]?.status ?? 'pending';
      s[st]++;
      if (st !== 'pending') ss.done++;
      if (st === 'fail') { ss.fail++; if (it.critical) s.criticalFail++; }
      if (st === 'pending' && it.mandatory) s.mandatoryPending++;
    }
    s.sections[sec.id] = ss;
  }
  for (const d of defects) {
    if (!OPEN_DEFECT(d)) continue;
    s.openDefects++;
    if (d.severity === 'critical') s.openCritical++;
    if (d.status === 'repair_completed' || d.status === 'awaiting_verification') s.awaitingVerification++;
  }
  return s;
}

/** Percentage of applicable (non-N/A) items that passed. */
export function passRate(s: InspectionSummary) {
  const applicable = s.total - s.na;
  return applicable ? Math.round((s.pass / applicable) * 100) : 0;
}
export function completionRate(s: InspectionSummary) {
  return s.total ? Math.round(((s.total - s.pending) / s.total) * 100) : 0;
}

export function missingApprovals(insp: Pick<Inspection, 'requiredApprovals' | 'approvals'>): Discipline[] {
  return insp.requiredApprovals.filter(d => insp.approvals[d]?.decision !== 'approved');
}

/**
 * Derives the workflow status. "approved" and "draft" are explicit decisions and are kept;
 * everything else follows from the recorded results, defects and approvals.
 * Nothing here ever authorizes operation — "approved" means approved for the next stage only.
 */
export function deriveStatus(insp: Pick<Inspection, 'status' | 'requiredApprovals' | 'approvals'>, s: InspectionSummary, userAction = false): InspectionStatus {
  if (insp.status === 'approved' || insp.status === 'draft') return insp.status;
  // A rejection stays visible until someone acts on the inspection again.
  if (insp.status === 'rejected' && !userAction) return 'rejected';
  const started = s.total - s.pending > 0;
  if (s.openDefects - s.awaitingVerification > 0) return 'failed_ca';
  if (s.awaitingVerification > 0) return 'awaiting_verification';
  if (s.pending > 0 || s.fail > 0) return started ? 'in_progress' : 'maintenance_completed';
  if (missingApprovals(insp).length) return 'awaiting_dept_approval';
  return 'ready_for_review';
}

/** Reasons that block final approval. Empty array = may be approved by an authorized person. */
export function approvalBlockers(insp: Inspection): { key: string; n?: number; overridable: boolean }[] {
  const s = insp.summary;
  const out: { key: string; n?: number; overridable: boolean }[] = [];
  if (s.mandatoryPending) out.push({ key: 'block.mandatoryPending', n: s.mandatoryPending, overridable: false });
  if (s.pending - s.mandatoryPending > 0) out.push({ key: 'block.pending', n: s.pending - s.mandatoryPending, overridable: false });
  if (s.openCritical) out.push({ key: 'block.openCritical', n: s.openCritical, overridable: true });
  if (s.criticalFail) out.push({ key: 'block.criticalFail', n: s.criticalFail, overridable: true });
  if (s.openDefects - s.openCritical > 0) out.push({ key: 'block.openDefects', n: s.openDefects - s.openCritical, overridable: false });
  if (s.fail - s.criticalFail > 0) out.push({ key: 'block.failed', n: s.fail - s.criticalFail, overridable: false });
  const miss = missingApprovals(insp);
  if (miss.length) out.push({ key: 'block.approvals', n: miss.length, overridable: false });
  return out;
}

/** Task pools: work is routed to a role, not a person, so anyone on the shift can pick it up. */
export function computePools(insp: Pick<Inspection, 'checklist' | 'requiredApprovals' | 'approvals' | 'status'>, s: InspectionSummary): string[] {
  if (insp.status === 'approved' || insp.status === 'draft') return [];
  const pools = new Set<string>();
  for (const sec of insp.checklist) {
    const ss = s.sections[sec.id];
    if (ss && (ss.done < ss.total || ss.fail > 0)) pools.add('exec:' + sec.discipline);
  }
  const execDone = s.pending === 0 && s.fail === 0 && s.openDefects === 0;
  if (execDone) {
    for (const d of missingApprovals(insp)) pools.add('approve:' + d);
    if (!missingApprovals(insp).length) pools.add('review');
  }
  return [...pools];
}

export function poolsForUser(u: UserProfile): string[] {
  const d = disciplineOf(u.role);
  if (d) return ['exec:' + d, 'approve:' + d];
  if (u.role === 'supervisor') return ['review'];
  if (u.role === 'manager') return ['review', ...DISCIPLINES.map(x => 'approve:' + x)];
  if (u.role === 'admin') return ['review'];
  return [];
}

export function isOverdue(d: Defect, today = new Date().toISOString().slice(0, 10)) {
  return OPEN_DEFECT(d) && !!d.targetDate && d.targetDate < today;
}

/**
 * Department readiness = share of the department's inspected equipment whose latest
 * inspection is approved. Equipment with an open critical defect never counts as ready.
 */
export function departmentReadiness(inspections: Inspection[], defects: Defect[], departmentId: string) {
  const latest = new Map<string, Inspection>();
  for (const i of inspections) {
    if (i.departmentId !== departmentId) continue;
    const cur = latest.get(i.equipmentId);
    if (!cur || (i.createdAt?.toMillis?.() ?? 0) > (cur.createdAt?.toMillis?.() ?? 0)) latest.set(i.equipmentId, i);
  }
  const criticalEq = new Set(defects.filter(d => OPEN_DEFECT(d) && d.severity === 'critical').map(d => d.equipmentId));
  let ready = 0; let blocked = 0;
  for (const [eq, i] of latest) {
    if (criticalEq.has(eq)) { blocked++; continue; }
    if (i.status === 'approved') ready++;
  }
  const total = latest.size;
  return { total, ready, blocked, pct: total ? Math.round((ready / total) * 100) : null };
}

export const STATUS_TONE: Record<InspectionStatus, 'gray' | 'blue' | 'orange' | 'red' | 'green' | 'purple'> = {
  draft: 'gray',
  maintenance_completed: 'blue',
  in_progress: 'orange',
  failed_ca: 'red',
  awaiting_verification: 'purple',
  awaiting_dept_approval: 'purple',
  ready_for_review: 'blue',
  approved: 'green',
  rejected: 'red',
};
export const ACTIVE_STATUSES: InspectionStatus[] = [
  'maintenance_completed', 'in_progress', 'failed_ca', 'awaiting_verification', 'awaiting_dept_approval', 'ready_for_review', 'rejected',
];
