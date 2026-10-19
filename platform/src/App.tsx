import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthState, useUser } from './auth/Auth';
import { DataProvider } from './data/DataProvider';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { Login } from './pages/Login';
import { can } from './lib/rules';

// Route-level code splitting keeps the first load small on phones.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Inspections = lazy(() => import('./pages/Inspections'));
const NewInspection = lazy(() => import('./pages/NewInspection'));
const InspectionView = lazy(() => import('./pages/InspectionView'));
const InspectionPrint = lazy(() => import('./pages/InspectionPrint'));
const Defects = lazy(() => import('./pages/Defects'));
const DefectView = lazy(() => import('./pages/DefectView'));
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'));
const EquipmentHistory = lazy(() => import('./pages/EquipmentHistory'));
const Templates = lazy(() => import('./pages/Templates'));
const TemplateEditor = lazy(() => import('./pages/TemplateEditor'));
const Users = lazy(() => import('./pages/Users'));
const Devices = lazy(() => import('./pages/Devices'));
const Documents = lazy(() => import('./pages/Documents'));
const Reports = lazy(() => import('./pages/Reports'));
const Audit = lazy(() => import('./pages/Audit'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function AdminOnly({ children }: { children: ReactNode }) {
  const u = useUser();
  return can.manageSystem(u) ? <>{children}</> : <Navigate to="/" replace />;
}
function LeadsOnly({ children }: { children: ReactNode }) {
  const u = useUser();
  return can.createInspection(u) ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const s = useAuthState();
  if (s.phase === 'loading') return <div className="center-screen"><Spinner /></div>;
  if (s.phase === 'signedOut') return <Login reason={s.reason} />;
  return (
    <DataProvider>
      <Suspense fallback={<div className="center-screen"><Spinner /></div>}>
        <Routes>
          <Route path="/print/inspection/:id" element={<InspectionPrint />} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </DataProvider>
  );
}
