import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AssetForm from '../components/AssetForm';
import { useApp } from '../context/AppProvider';
import type { AssetFormData, AssetType } from '../types';
import { newAssetPrefillFromCategory } from '../lib/dashboardCategories';

export default function NewAssetPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as { mainCategory?: string; assetType?: AssetType } | null) || {};
  const sidebarPrefill = newAssetPrefillFromCategory(navState.mainCategory);
  const prefillMainCategory = sidebarPrefill.mainCategory ?? navState.mainCategory;
  const prefillAssetType = navState.assetType ?? sidebarPrefill.assetType;
  const { handleSubmit, user } = useApp();
  const [loading, setLoading] = useState(false);

  if (user?.role === 'HR') {
    return <Navigate to="/employees" replace />;
  }

  const onSubmit = async (data: AssetFormData) => {
    try {
      setLoading(true);
      await handleSubmit(data, null);
      navigate('/dashboard');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-5 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">New registration</p>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">Register New Asset</h1>
            <p className="text-sm text-slate-500 mt-1">
              Select department and asset type, then complete details and assignment.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full px-6 lg:px-10 py-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-10">
            <AssetForm
              layout="page"
              prefillMainCategory={prefillMainCategory}
              prefillAssetType={prefillAssetType}
              onSubmit={onSubmit}
              onCancel={() => navigate('/dashboard')}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
