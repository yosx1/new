import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Timestamp, getDocsFromCache, limit, orderBy, query, where, type Query } from 'firebase/firestore';
import { getCountFromServer, getDocs, onSnapshot, startMeter } from '../lib/fs';
import { col, ref } from '../lib/db';
import { auth } from '../firebase';
import { useUser } from '../auth/Auth';
import { ensureShutdown } from '../lib/actions';
import { isLead } from '../lib/rules';
import type { AppNotification, Department, Equipment, Inspection, Settings, Shutdown, UserProfile } from '../types';
import { DEFAULT_SETTINGS, ensureDepartments } from './seed';

interface Data {
  loaded: boolean;
  settings: Settings;
  /** Active departments, in order. */
  departments: Department[];
  /** Including retired ones (for old records and administration). */
  allDepartments: Department[];
  equipment: Equipment[];
  users: UserProfile[];
  /** Inspections of the current shutdown, live. */
  inspections: Inspection[];
  /** Inspections of closed shutdowns (Done): null until needPast() has loaded them. */
  past: Inspection[] | null;
  /** Number of Done inspections (counted on the server, cheap). */
  archivedCount: number | null;
  /** Loads the Done inspections once (from the device cache when nothing changed). */
  needPast: () => void;
  /** Forget the loaded Done inspections (after archiving, renaming or deleting). */
  refreshPast: () => void;
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

const ms = (v: unknown) => (v && typeof (v as { toMillis?: () => number }).toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : Number.MAX_SAFE_INTEGER);

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

const byCode = (a: Equipment, b: Equipment) => (a.code || '~' + a.name).localeCompare(b.code || '~' + b.name, 'en', { numeric: true });

/**
 * The equipment list (~800 items) is cached on the device. On start, and whenever config/catalog says the list
 * changed, only equipment updated since the last sync are read; the whole list is read only the first time
 * (or when the cache was cleared). This keeps daily reads far below the free plan's limit.
 */
function useCatalog(uid: string): [Equipment[], boolean] {
  const [rows, setRows] = useState<Equipment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState<number | null | undefined>(undefined);
  useEffect(() => onSnapshot(ref('config', 'catalog'), s => setVersion(s.exists() ? Number(s.data().v) : 0), () => setVersion(null)), []);
  useEffect(() => {
    if (version === undefined) return;
    let stop = false;
    const key = 'eqSync:' + uid;
    const all = query(col('equipment'));
    const done = (docs: { id: string; data: () => object }[]) => {
      if (stop) return;
      setRows(docs.map(d => ({ id: d.id, ...d.data() }) as Equipment).sort(byCode));
      setLoaded(true);
    };
    const newest = (docs: { data: () => { updatedAt?: Timestamp } }[], from = 0) =>
      docs.reduce((m, d) => Math.max(m, d.data().updatedAt?.toMillis?.() ?? 0), from);
    (async () => {
      let saved: { at: number; n: number } | null = null;
      try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* private mode */ }
      const save = (v: { at: number; n: number }) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
      try {
        if (saved) {
          const cached = await getDocsFromCache(all);
          if (cached.size === saved.n) {
            done(cached.docs);
            // only what changed since the last sync (a single read when nothing did)
            const changed = await getDocs(query(col('equipment'), where('updatedAt', '>', Timestamp.fromMillis(saved.at))));
            if (changed.size) {
              const merged = await getDocsFromCache(all);
              done(merged.docs);
              save({ at: newest(changed.docs, saved.at), n: merged.size });
            }
            return;
          }
        }
        const full = await getDocs(all);
        done(full.docs);
        save({ at: newest(full.docs), n: full.size });
      } catch {
        // offline: whatever the device has
        try { done((await getDocsFromCache(all)).docs); } catch { if (!stop) setLoaded(true); }
      }
    })();
    return () => { stop = true; };
  }, [version, uid]);
  return [rows, loaded];
}

export function DataProvider({ children }: { children: ReactNode }) {
  const me = useUser();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [currentId, setCurrentId] = useState<string | null | undefined>(undefined);
  const [pend, setPend] = useState(false);
  const startedShutdown = useRef(false);
  const startedDepts = useRef(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => startMeter(), []);

  useEffect(() => onSnapshot(ref('config', 'settings'), s => {
    if (s.exists()) setSettings({ ...DEFAULT_SETTINGS, ...(s.data() as Partial<Settings>) });
  }, () => {}), []);
  // An error while signing out must not look like "no shutdown yet" (that would try to start one).
  useEffect(() => onSnapshot(ref('config', 'shutdown'), s => setCurrentId(s.exists() ? (s.data().currentId as string) : null), () => { if (auth.currentUser) setCurrentId(null); }), []);

  const [allDepartments, l1] = useLive<Department>(query(col('departments'), orderBy('order')), []);
  const departments = useMemo(() => allDepartments.filter(d => d.active !== false), [allDepartments]);
  const [allEquipment, l2] = useCatalog(me.id);
  // Equipment of a retired department drops out of pools, menus and reports (old inspections still find it via eq()).
  // Lists show active equipment of active departments only; retired equipment stay reachable through eq(id)
  // so old inspections and reports still show their names.
  const equipment = useMemo(() => { const on = new Set(departments.map(d => d.id)); return allEquipment.filter(e => e.active !== false && on.has(e.departmentId)); }, [allEquipment, departments]);
  const [users, l3] = useLive<UserProfile>(query(col('users'), orderBy('name')), []);
  // Only the current shutdown is kept live: this is what keeps daily reads low on the free plan.
  // Team members load only their own discipline (and department): less to read, and nothing of other teams.
  const teamOnly = me.role === 'member' && !!me.discipline;
  const teamWhere = () => (teamOnly ? [where('discipline', '==', me.discipline), ...(me.departmentId ? [where('departmentId', '==', me.departmentId)] : [])] : []);
  const [liveInsp, l4] = useLive<Inspection>(currentId ? query(col('inspections'), where('shutdownId', '==', currentId), ...teamWhere()) : null, [currentId, me.role, me.discipline, me.departmentId], setPend);
  const inspections = useMemo(() => [...liveInsp].sort((a, b) => ms(b.createdAt) - ms(a.createdAt)), [liveInsp]);
  const [shutdowns, l5] = useLive<Shutdown>(query(col('shutdowns'), orderBy('year', 'desc')), []);
  const [notifications] = useLive<AppNotification>(
    query(col('notifications'), where('toUid', '==', me.id), orderBy('createdAt', 'desc'), limit(30)), [me.id]);

  // First sign-in of a manager or administrator: create the departments and the current shutdown.
  useEffect(() => {
    if (!isLead(me) || !navigator.onLine || !auth.currentUser) return;
    if (me.role === 'admin' && l1 && allDepartments.length === 0 && !startedDepts.current) {
      startedDepts.current = true;
      ensureDepartments(me).catch(e => { startedDepts.current = false; console.warn('departments', e); });
    }
    if (currentId === null && !startedShutdown.current) {
      startedShutdown.current = true;
      ensureShutdown(me).catch(e => { startedShutdown.current = false; console.warn('shutdown', e); });
    }
  }, [me, l1, allDepartments.length, currentId]);

  // Done inspections: counted cheaply; the documents load only when a page needs them.
  const [past, setPast] = useState<Inspection[] | null>(null);
  const [archivedCount, setArchivedCount] = useState<number | null>(null);
  const [pastWanted, setPastWanted] = useState(0);
  const [pastGen, setPastGen] = useState(0);
  const needPast = useCallback(() => setPastWanted(w => w || 1), []);
  const refreshPast = useCallback(() => { setPast(null); setPastGen(g => g + 1); }, []);
  const sig = useMemo(() => shutdowns.map(x => `${x.id}:${x.name}:${x.status}`).sort().join('|'), [shutdowns]);
  useEffect(() => { refreshPast(); }, [currentId, refreshPast]);
  useEffect(() => {
    if (currentId === undefined || !auth.currentUser) return;
    let stop = false;
    const q = query(col('inspections'), where('status', '==', 'archived'), ...teamWhere());
    (async () => {
      let total: number | null = null;
      try { total = (await getCountFromServer(q)).data().count; } catch { /* offline */ }
      if (stop) return;
      if (total !== null) setArchivedCount(total);
      if (!pastWanted) return;
      const key = 'pastSig';
      const rows = (docs: { id: string; data: () => object }[]) => docs.map(d => ({ id: d.id, ...d.data() }) as Inspection).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
      // Closed shutdowns rarely change: reuse the device cache when the count and the shutdown names still match.
      try {
        const c = await getDocsFromCache(q);
        let same = false; try { same = localStorage.getItem(key) === sig + me.id; } catch { /* private mode */ }
        if ((total === null || (same && c.size === total)) && !stop) { setPast(rows(c.docs)); if (total === null) setArchivedCount(c.size); return; }
      } catch { /* nothing cached */ }
      try {
        const sv = await getDocs(q);
        if (stop) return;
        setPast(rows(sv.docs)); setArchivedCount(sv.size);
        try { localStorage.setItem(key, sig + me.id); } catch { /* private mode */ }
      } catch { if (!stop) setPast([]); }
    })();
    return () => { stop = true; };
  }, [currentId, pastWanted, pastGen, sig, me.role, me.discipline, me.departmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<Data>(() => {
    const dMap = new Map(allDepartments.map(d => [d.id, d]));
    const eMap = new Map(allEquipment.map(e => [e.id, e]));
    const uMap = new Map(users.map(u => [u.id, u]));
    return {
      loaded: l1 && l2 && l3 && l4 && l5 && currentId !== undefined,
      settings, departments, allDepartments, equipment, users, inspections, shutdowns, notifications,
      past, archivedCount, needPast, refreshPast,
      shutdown: shutdowns.find(s => s.id === currentId) ?? null,
      pendingWrites: pend, online,
      dept: id => (id ? dMap.get(id) : undefined),
      eq: id => (id ? eMap.get(id) : undefined),
      userName: uid => (uid ? uMap.get(uid)?.name ?? '—' : '—'),
    };
  }, [settings, departments, allDepartments, equipment, allEquipment, users, inspections, past, archivedCount, needPast, refreshPast, shutdowns, notifications, currentId, pend, online, l1, l2, l3, l4, l5]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);

/** Current and Done inspections together; loads the Done ones on first use (when `want` is true). */
export function useAllInspections(want = true) {
  const { inspections, past, needPast } = useContext(Ctx);
  useEffect(() => { if (want) needPast(); }, [want, needPast]);
  return useMemo(() => {
    if (!want || !past) return inspections;
    const ids = new Set(inspections.map(i => i.id));
    return [...inspections, ...past.filter(i => !ids.has(i.id))];
  }, [want, inspections, past]);
}
