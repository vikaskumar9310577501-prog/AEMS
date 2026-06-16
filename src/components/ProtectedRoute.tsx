import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppProvider';
import { APP_NAME, LOGO_SRC } from '../lib/constants';

export default function ProtectedRoute() {
  const { user, authChecked } = useApp();
  const location = useLocation();

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-4">
        <img src={LOGO_SRC} alt={APP_NAME} className="w-16 h-16 object-contain" />
        <p className="text-sm font-black text-slate-700 uppercase tracking-widest">{APP_NAME}</p>
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}
