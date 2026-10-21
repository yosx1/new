import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthState, useUser } from './auth/Auth';
import { DataProvider } from './data/DataProvider';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { Login } from './pages/Login';
import { can } from './lib/rules';

// Route-level code splitting keeps the first load small; every page is then fetched in the background
// right after sign-in so moving between pages never waits (or flashes a spinner).
const LOADERS = {
  Dashboard: () => import('./pages/Dashboard'),
  Tasks: () => import('./pages/Tasks'),
  Inspections: () => import('./pages/Inspections'),
  NewInspection: () => import('./pages/NewInspection'),
  InspectionView: () => import('./pages/InspectionView'),
  InspectionPrint: () => import('./pages/InspectionPrint'),
  Defects: () => import('./pages/Defects'),
  DefectView: () => import('./pages/DefectView'),
  EquipmentPage: () => import('./pages/EquipmentPage'),
  EquipmentHistory: () => import('./pages/EquipmentHistory'),
  Templates: () => import('./pages/Templates'),
  TemplateEditor: () => import('./pages/TemplateEditor'),
  Users: () => import('./pages/Users'),
  Devices: () => import('./pages/Devices'),
  Documents: () => import('./pages/Documents'),
  Reports: () => import('./pages/Reports'),
  Audit: () => import('./pages/Audit'),
  SettingsPage: () => import('./pages/SettingsPage'),
  Help: () => import('./pages/Help'),
};
const Dashboard = lazy(LOADERS.Dashboard);
const Tasks = lazy(LOADERS.Tasks);
const Inspections = lazy(LOADERS.Inspections);
const NewInspection = lazy(LOADERS.NewInspection);
const InspectionView = lazy(LOADERS.InspectionView);
const InspectionPrint = lazy(LOADERS.InspectionPrint);
const Defects = lazy(LOADERS.Defects);
const DefectView = lazy(LOADERS.DefectView);
const EquipmentPage = lazy(LOADERS.EquipmentPage);
const EquipmentHistory = lazy(LOADERS.EquipmentHistory);
const Templates = lazy(LOADERS.Templates);
const TemplateEditor = lazy(LOADERS.TemplateEditor);
const Users = lazy(LOADERS.Users);
const Devices = lazy(LOADERS.Devices);
const Documents = lazy(LOADERS.Documents);
const Reports = lazy(LOADERS.Reports);
const Audit = lazy(LOADERS.Audit);
const SettingsPage = lazy(LOADERS.SettingsPage);
const Help = lazy(LOADERS.Help);

function AdminOnly({ children }: { children: ReactNode }) {
  const u = useUser();
  return can.manageSystem(u) ? <>{children}</> : <Navigate to="/" replace />;
}
function LeadsOnly({ children }: { children: ReactNode }) {
  const u = useUser();
  return can.createInspection(u) ? <>{children}</> : <Navigate to="/" replace />;
}

function Preload() {
  useEffect(() => {
    const go = () => Object.values(LOADERS).forEach(load => load().catch(() => {}));
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(go); else setTimeout(go, 1500);
  }, []);
  return null;
}

export default function App() {
  const s = useAuthState();
  if (s.phase === 'loading') return <div className="center-screen"><Spinner /></div>;
  if (s.phase === 'signedOut') return <Login reason={s.reason} />;
  return (
    <DataProvider>
      <Preload />
        <Routes>
          <Route path="/print/inspection/:id" element={<Suspense fallback={<div className="center-screen"><Spinner /></div>}><InspectionPrint /></Suspense>} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="inspections" element={<Inspections />} />
            <Route path="inspections/new" element={<LeadsOnly><NewInspection /></LeadsOnly>} />
            <Route path="inspections/:id" element={<InspectionView />} />
            <Route path="defects" element={<Defects />} />
            <Route path="defects/:id" element={<DefectView />} />
            <Route path="equipment" element={<EquipmentPage />} />
            <Route path="equipment/:id" element={<EquipmentHistory />} />
            <Route path="templates" element={<AdminOnly><Templates /></AdminOnly>} />
            <Route path="templates/:id" element={<AdminOnly><TemplateEditor /></AdminOnly>} />
            <Route path="users" element={<AdminOnly><Users /></AdminOnly>} />
            <Route path="devices" element={<AdminOnly><Devices /></AdminOnly>} />
            <Route path="documents" element={<Documents />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit" element={<Audit />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="help" element={<Help />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
    </DataProvider>
  );
}
