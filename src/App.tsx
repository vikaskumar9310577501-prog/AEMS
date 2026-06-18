import { useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider, useApp } from './context/AppProvider';
import LoginScreen from './components/LoginScreen';
import ProtectedRoute from './components/ProtectedRoute';
import RoutePersistence from './components/RoutePersistence';
import AppLayout from './layout/AppLayout';
import SplashScreen, { shouldShowSplash } from './components/SplashScreen';
import { APP_NAME, LOGO_SRC } from './lib/constants';
import { MISSING_ITEMS_FEATURE_ENABLED } from './lib/features';
import { resolvePostAuthRoute } from './lib/lastRoute';
import DashboardPage from './pages/DashboardPage';
import NewAssetPage from './pages/NewAssetPage';
import EditAssetPage from './pages/EditAssetPage';
import AssetDetailPage from './pages/AssetDetailPage';
import SettingsPage from './pages/SettingsPage';
import UserManagement from './pages/UserManagement';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeProfilePage from './pages/EmployeeProfilePage';
import MissingItemsPage from './pages/MissingItemsPage';
import DamagedScrapPage from './pages/DamagedScrapPage';

function AuthLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-4">
      <img src={LOGO_SRC} alt={APP_NAME} className="w-24 h-24 object-contain logo-sidebar-pulse" />
      <p className="text-sm font-black text-slate-700 uppercase tracking-widest">{APP_NAME}</p>
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

function LoginRoute() {
  const { user, authChecked } = useApp();
  const location = useLocation();
  if (!authChecked) return <AuthLoading />;
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={resolvePostAuthRoute(from)} replace />;
  }
  return <LoginScreen />;
}

function IndexRedirect() {
  const { user } = useApp();
  if (user?.role === 'HR') {
    return <Navigate to="/employees" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  const [splashDone, setSplashDone] = useState(() => !shouldShowSplash());

  if (!splashDone) {
    return <SplashScreen onComplete={() => setSplashDone(true)} />;
  }

  return (
      <>
      <RoutePersistence />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<IndexRedirect />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="assets/new" element={<NewAssetPage />} />
            <Route path="assets/:assetId" element={<AssetDetailPage />} />
            <Route path="assets/:assetId/edit" element={<EditAssetPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="employees/:employeeId" element={<EmployeeProfilePage />} />
            {MISSING_ITEMS_FEATURE_ENABLED && <Route path="missing" element={<MissingItemsPage />} />}
            <Route path="damaged-scrap" element={<DamagedScrapPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="users" element={<UserManagement key="users-page" />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Toaster position="top-right" />
      <AppRoutes />
    </AppProvider>
  );
}
