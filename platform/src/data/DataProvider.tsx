import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { limit, onSnapshot, orderBy, query, where, type Query } from 'firebase/firestore';
import { col, ref } from '../lib/db';
import { useUser } from '../auth/Auth';
import { ensureShutdown } from '../lib/actions';
import { isLead } from '../lib/rules';
import type { AppNotification, Department, Equipment, Inspection, Settings, Shutdown, UserProfile } from '../types';
import { DEFAULT_SETTINGS, ensureDepartments } from './seed';

interface Data {
  loaded: boolean;
  settings: Settings;
  departments: Department[];
  equipment: Equipment[];
  users: UserProfile[];
  inspections: Inspection[];
  /** The open yearly shutdown (null until a manager or administrator has signed in once). */
  shutdown: Shutdown | null;
  shutdowns: Shutdown[];
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
  const [currentId, setCurrentId] = useState<string | null | undefined>(undefined);
  const [pend, setPend] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => onSnapshot(ref('config', 'settings'), s => {
    if (s.exists()) setSettings({ ...DEFAULT_SETTINGS, ...(s.data() as Partial<Settings>) });
  }, () => {}), []);
  useEffect(() => onSnapshot(ref('config', 'shutdown'), s => setCurrentId(s.exists() ? (s.data().currentId as string) : null), () => setCurrentId(null)), []);

  const [departments, l1] = useLive<Department>(query(col('departments'), orderBy('order')), []);
  const [equipment, l2] = useLive<Equipment>(query(col('equipment'), orderBy('name')), []);
  const [users, l3] = useLive<UserProfile>(query(col('users'), orderBy('name')), []);
  const [inspections, l4] = useLive<Inspection>(query(col('inspections'), orderBy('createdAt', 'desc'), limit(3000)), [], setPend);
  const [shutdowns, l5] = useLive<Shutdown>(query(col('shutdowns'), orderBy('year', 'desc')), []);
  const [notifications] = useLive<AppNotification>(
    query(col('notifications'), where('toUid', '==', me.id), orderBy('createdAt', 'desc'), limit(30)), [me.id]);

  // First sign-in of a manager or administrator: create the departments and the current shutdown.
  useEffect(() => {
    if (!isLead(me) || !navigator.onLine) return;
    if (me.role === 'admin' && l1 && departments.length < 4) ensureDepartments(me).catch(e => console.warn('departments', e));
    if (currentId === null) ensureShutdown(me).catch(e => console.warn('shutdown', e));
  }, [me, l1, departments.length, currentId]);

  const value = useMemo<Data>(() => {
    const dMap = new Map(departments.map(d => [d.id, d]));
    const eMap = new Map(equipment.map(e => [e.id, e]));
    const uMap = new Map(users.map(u => [u.id, u]));
    return {
      loaded: l1 && l2 && l3 && l4 && l5 && currentId !== undefined,
      settings, departments, equipment, users, inspections, shutdowns, notifications,
      shutdown: shutdowns.find(s => s.id === currentId) ?? null,
      pendingWrites: pend, online,
      dept: id => (id ? dMap.get(id) : undefined),
      eq: id => (id ? eMap.get(id) : undefined),
      userName: uid => (uid ? uMap.get(uid)?.name ?? '—' : '—'),
    };
  }, [settings, departments, equipment, users, inspections, shutdowns, notifications, currentId, pend, online, l1, l2, l3, l4, l5]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);
