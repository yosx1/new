import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin' | 'manager' | 'member';
export const ROLES: Role[] = ['admin', 'manager', 'member'];

/** Every piece of equipment has parts in each discipline; a team member inspects the parts of their own discipline. */
export type Discipline = 'mechanical' | 'electrical' | 'instrumentation' | 'production';
export const DISCIPLINES: Discipline[] = ['mechanical', 'electrical', 'instrumentation', 'production'];

export type Lang = 'ar' | 'en';
export type TS = Timestamp | null;

export interface Bilingual { en: string; ar: string }

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Team members only: the parts they inspect. */
  discipline?: Discipline | null;
  /** Team members only: their department (null = all departments). */
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
  name: string;
  departmentId: string;
  parts: Record<Discipline, string[]>;
  active: boolean;
  updatedAt?: TS;
}

/** The yearly shutdown that every cold run belongs to. */
export interface Shutdown {
  id: string;
  name: string;
  year: number;
  status: 'open' | 'closed';
  startedAt: TS;
  closedAt?: TS;
  closedBy?: string;
  closedByName?: string;
  /** Number of inspections archived when it was closed. */
  archived?: number;
}

export type PartStatus = 'pending' | 'ok' | 'notok';
export interface PartResult {
  status: PartStatus;
  note: string;
  photoIds: string[];
  by: string;
  byName: string;
  at: TS;
  /** Corrective maintenance done on a "Not OK" part. */
  fix?: { note: string; photoIds: string[]; by: string; byName: string; at: TS } | null;
}

/** pool = waiting in the team's pool; corrective / waiting_approval / approved = active; archived = done. */
export type InspectionStatus = 'pool' | 'corrective' | 'waiting_approval' | 'approved' | 'archived';
export const ACTIVE_STATUSES: InspectionStatus[] = ['corrective', 'waiting_approval', 'approved'];

export interface InspectionSummary { total: number; ok: number; notok: number; fixed: number; pending: number }

export interface Inspection {
  id: string;
  code: string;
  shutdownId: string;
  shutdownName: string;
  /** Always the equipment name. */
  title: string;
  equipmentId: string;
  departmentId: string;
  discipline: Discipline;
  parts: { id: string; name: string }[];
  results: Record<string, PartResult>;
  summary: InspectionSummary;
  status: InspectionStatus;
  createdBy: string;
  createdByName: string;
  createdAt: TS;
  updatedAt: TS;
  submittedAt?: TS;
  approval?: { by: string; byName: string; at: TS; comment: string } | null;
  rejection?: { by: string; byName: string; at: TS; reason: string } | null;
  archivedAt?: TS;
  docVersion: number;
}

export interface Attachment {
  id: string;
  ownerType: 'result' | 'inspection' | 'document' | 'equipment';
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
  /** Who gets the completion report when an inspection is approved. Empty = all active managers and administrators. */
  reportRecipientUids?: string[];
  /** Extra addresses (outside the platform) that also receive the e-mail. */
  reportEmails?: string[];
  /** Google Apps Script web-app URL that sends the e-mails (the free plan has no server of its own). */
  emailRelayUrl?: string;
  /** The weekly Google Drive backup folder is shared with this address. */
  backupEmail?: string;
}
