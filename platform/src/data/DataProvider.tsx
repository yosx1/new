import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { limit, onSnapshot, orderBy, query, where, type Query } from 'firebase/firestore';
import { col, ref } from '../lib/db';
import { useUser } from '../auth/Auth';
import type {
  AppNotification, Defect, Department, Equipment, Inspection, Settings, Template, UserProfile,
} from '../types';
import { DEFAULT_SETTINGS } from './seed';

interface Data {
  loaded: boolean;
  settings: Settings;
  departments: Department[];
  equipment: Equipment[];
  templates: Template[];
  users: UserProfile[];
  inspections: Inspection[];
  defects: Defect[];
  notifications: AppNotification[];
  pendingWrites: boolean;
  online: boolean;
  dept: (id?: string | null) => Department | undefined;
  eq: (id?: string | null) => Equipment | undefined;
  userName: (uid?: string | null) => string;
}

const Ctx = createContext<Data>(null as unknown as Data);

function useLive<T>(q: Query | null, deps: unknown[], onPending?: (p: boolean) => void): [T[], boolean] {
  const [rows, setRows] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!q) { setLoaded(true); return; }
    return onSnapshot(q, { includeMetadataChanges: !!onPending }, snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() }) as T));
      setLoaded(true);
      onPending?.(snap.metadata.hasPendingWrites);
    }, err => { console.warn('listen failed', err); setLoaded(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [rows, loaded];
}

export function DataProvider({ children }: { children: ReactNode }) {
  const me = useUser();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [pendA, setPendA] = useState(false);
  const [pendB, setPendB] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => onSnapshot(ref('config', 'settings'), s => {
    if (s.exists()) setSettings({ ...DEFAULT_SETTINGS, ...(s.data() as Partial<Settings>) });
  }, () => {}), []);

  const [departments, l1] = useLive<Department>(query(col('departments'), orderBy('order')), []);
  const [equipment, l2] = useLive<Equipment>(query(col('equipment'), orderBy('tag')), []);
  const [templates, l3] = useLive<Template>(query(col('templates'), orderBy('code')), []);
  const [users, l4] = useLive<UserProfile>(query(col('users'), orderBy('name')), []);
  // Most recent records are kept live; older history is fetched on demand in History/Reports.
  const [inspections, l5] = useLive<Inspection>(query(col('inspections'), orderBy('createdAt', 'desc'), limit(400)), [], setPendA);
  const [defects, l6] = useLive<Defect>(query(col('defects'), orderBy('reportedAt', 'desc'), limit(800)), [], setPendB);
  const [notifications] = useLive<AppNotification>(
    query(col('notifications'), where('toUid', '==', me.id), orderBy('createdAt', 'desc'), limit(30)), [me.id]);

  const value = useMemo<Data>(() => {
    const dMap = new Map(departments.map(d => [d.id, d]));
    const eMap = new Map(equipment.map(e => [e.id, e]));
    const uMap = new Map(users.map(u => [u.id, u]));
    return {
      loaded: l1 && l2 && l3 && l4 && l5 && l6,
      settings, departments, equipment, templates, users, inspections, defects, notifications,
      pendingWrites: pendA || pendB, online,
      dept: id => (id ? dMap.get(id) : undefined),
      eq: id => (id ? eMap.get(id) : undefined),
      userName: uid => (uid ? uMap.get(uid)?.name ?? '—' : '—'),
    };
  }, [settings, departments, equipment, templates, users, inspections, defects, notifications, pendA, pendB, online, l1, l2, l3, l4, l5, l6]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);
