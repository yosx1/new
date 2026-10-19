import type { Timestamp } from 'firebase/firestore';

export type Role =
  | 'admin'
  | 'supervisor'
  | 'manager'
  | 'mechanical'
  | 'electrical'
  | 'instrumentation'
  | 'production'
  | 'viewer';

/** Disciplines own checklist sections, defect pools and departmental approvals. */
export type Discipline = 'mechanical' | 'electrical' | 'instrumentation' | 'production';
export const DISCIPLINES: Discipline[] = ['mechanical', 'electrical', 'instrumentation', 'production'];
export const ROLES: Role[] = ['admin', 'supervisor', 'manager', 'mechanical', 'electrical', 'instrumentation', 'production', 'viewer'];

export type Lang = 'ar' | 'en';
export type TS = Timestamp | null;

export interface Bilingual { en: string; ar: string }

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId?: string | null;
  phone?: string;
  active: boolean;
  lang?: Lang;
  createdAt?: TS;
  createdBy?: string;
}

export interface Device {
  id: string;
  uid: string;
  userName: string;
  label: string;
  platform: string;
  userAgent: string;
  appVersion: string;
  lastSeen: TS;
  firstSeen: TS;
  revoked: boolean;
  revokedBy?: string;
}

export interface Department {
  id: string;
  code: string;
  name: Bilingual;
  order: number;
  active: boolean;
}

export interface Equipment {
  id: string;
  tag: string;
  name: Bilingual;
  departmentId: string;
  line?: string;
  category: string;
  location?: string;
  manufacturer?: string;
  model?: string;
  parentId?: string | null;
  templateIds?: string[];
  active: boolean;
  notes?: string;
}

export interface ChecklistItemDef {
  id: string;
  label: Bilingual;
  mandatory: boolean;
  critical: boolean;
  /** Measurement is shown only when unit is set. Limits are equipment-specific and optional. */
  measure?: { unit: string; min?: number | null; max?: number | null } | null;
  naReasonRequired?: boolean;
  photoRequired?: boolean;
  procedureRef?: string;
  guidance?: Bilingual;
}

export interface ChecklistSection {
  id: string;
  title: Bilingual;
  discipline: Discipline;
  stage: string;
  items: ChecklistItemDef[];
}

export interface Template {
  id: string;
  code: string;
  name: Bilingual;
  equipmentCategories: string[];
  maintenanceTypes: string[];
  requiredApprovals: Discipline[];
  currentVersion: number;
  active: boolean;
  updatedAt?: TS;
  updatedBy?: string;
}

export interface TemplateVersion {
  id: string; // version number as string
  version: number;
  sections: ChecklistSection[];
  notes?: string;
  createdAt: TS;
  createdBy: string;
  createdByName: string;
}

export type ItemStatus = 'pass' | 'fail' | 'pending' | 'na';

export type InspectionStatus =
  | 'draft'
  | 'maintenance_completed'
  | 'in_progress'
  | 'failed_ca'
  | 'awaiting_verification'
  | 'awaiting_dept_approval'
  | 'ready_for_review'
  | 'approved'
  | 'rejected';

export interface ApprovalRecord {
  decision: 'approved' | 'rejected';
  by: string;
  byName: string;
  at: TS;
  comment?: string;
}

export interface InspectionSummary {
  total: number;
  pass: number;
  fail: number;
  pending: number;
  na: number;
  mandatoryPending: number;
  criticalFail: number;
  openDefects: number;
  openCritical: number;
  awaitingVerification: number;
  sections: Record<string, { done: number; total: number; fail: number }>;
}

export interface Inspection {
  id: string;
  code: string;
  title: string;
  plantName: string;
  departmentId: string;
  equipmentId: string;
  equipmentTag: string;
  equipmentName: Bilingual;
  equipmentCategory: string;
  workOrder: string;
  maintenanceType: string;
  maintenanceCompletedAt: string; // yyyy-mm-dd
  inspectionDate: string; // yyyy-mm-dd
  shift: string;
  supervisorUid: string;
  productionEngUid?: string | null;
  maintenanceEngUid?: string | null;
  assignedUids: string[];
  remarks?: string;
  templateId: string;
  templateCode: string;
  templateName: Bilingual;
  templateVersion: number;
  checklist: ChecklistSection[];
  requiredApprovals: Discipline[];
  approvals: Partial<Record<Discipline | 'final', ApprovalRecord>>;
  override?: { by: string; byName: string; at: TS; justification: string } | null;
  status: InspectionStatus;
  summary: InspectionSummary;
  /** Task pools this inspection currently feeds, e.g. "exec:mechanical", "approve:electrical", "review". */
  pools: string[];
  createdAt: TS;
  createdBy: string;
  createdByName: string;
  updatedAt: TS;
  docVersion: number;
}

export interface ItemResult {
  id: string; // item id
  sectionId: string;
  discipline: Discipline;
  status: ItemStatus;
  value?: number | null;
  unit?: string;
  comment?: string;
  naReason?: string;
  inspectorUid: string;
  inspectorName: string;
  at: TS;
  assignedUid?: string | null;
  defectId?: string | null;
  photoIds?: string[];
  supervisorComment?: string;
  rev: number;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

export type DefectStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'repair_completed'
  | 'awaiting_verification'
  | 'closed';
export const DEFECT_FLOW: DefectStatus[] = ['open', 'assigned', 'in_progress', 'repair_completed', 'awaiting_verification', 'closed'];

export interface Defect {
  id: string;
  code: string;
  inspectionId: string;
  inspectionCode: string;
  departmentId: string;
  equipmentId: string;
  equipmentTag: string;
  itemId: string;
  itemLabel: Bilingual;
  description: string;
  severity: Severity;
  /** Responsible discipline = the pool that sees this defect. */
  pool: Discipline;
  assignedUid?: string | null;
  assignedName?: string | null;
  reportedAt: TS;
  reportedBy: string;
  reportedByName: string;
  targetDate: string; // yyyy-mm-dd
  correctiveAction?: string;
  photoIds?: string[];
  status: DefectStatus;
  repair?: { by: string; byName: string; at: TS; notes?: string } | null;
  verification?: { result: 'pass' | 'fail'; by: string; byName: string; at: TS; notes?: string } | null;
  closedAt?: TS;
  reopenCount?: number;
  updatedAt: TS;
}

export interface Attachment {
  id: string;
  ownerType: 'result' | 'defect' | 'inspection' | 'document' | 'equipment';
  ownerId: string;
  inspectionId?: string | null;
  kind: 'before' | 'after' | 'evidence' | 'file';
  name: string;
  mime: string;
  size: number;
  data: string; // data URL
  createdBy: string;
  createdAt: TS;
}

export interface LibraryDoc {
  id: string;
  title: Bilingual;
  category: string;
  url?: string;
  attachmentId?: string | null;
  departmentId?: string | null;
  equipmentId?: string | null;
  templateId?: string | null;
  /** Roles that can open the document; 'all' means everyone. */
  visibleTo: (Role | 'all')[];
  createdAt: TS;
  createdBy: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  label?: string;
  uid: string;
  userName: string;
  at: TS;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  note?: string;
}

export interface AppNotification {
  id: string;
  toUid: string;
  title: Bilingual;
  link: string;
  read: boolean;
  createdAt: TS;
}

export interface Settings {
  plantName: Bilingual;
  shifts: string[];
  maintenanceTypes: string[];
  equipmentCategories: string[];
  overrideRoles: Role[];
  defectTargetDays: Record<Severity, number>;
}
