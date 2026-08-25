import { useMemo, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AssetForm from '../components/AssetForm';
import { useApp } from '../context/AppProvider';
import { findAssetByRouteId } from '../lib/assetLookup';
import { healMisalignedAssetFields } from '../lib/healAssetFields';
import type { AssetFormData } from '../types';

export default function EditAssetPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const { assets, loading: assetsLoading, handleSubmit, user } = useApp();
  const [loading, setLoading] = useState(false);

  const asset = useMemo(() => {
    const raw = assetId ? findAssetByRouteId(assets, assetId) : undefined;
    return raw ? healMisalignedAssetFields(raw) : undefined;
  }, [assets, assetId]);

  if (user?.role === 'HR') {
    return <Navigate to="/employees" replace />;
  }

  const onSubmit = async (data: AssetFormData) => {
    if (!asset) return;
    try {
      setLoading(true);
      await handleSubmit(data, asset);
      navigate(`/assets/${assetId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  if (!assetsLoading && !asset) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-black text-slate-900">Asset not found</h2>
          <p className="text-sm text-slate-500 mt-2">This asset may have been removed or the link is invalid.</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mt-6 btn-primary-geometric"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 shrink-0 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate(assetId ? `/assets/${assetId}` : '/dashboard')}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Edit asset</p>
            <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
              Edit Asset #{asset ? String(asset.id).padStart(3, '0') : '...'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Update details, network specs, or reassign to another employee.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          {asset ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 lg:p-8">
              <AssetForm
                key={asset.id}
                layout="page"
                initialData={asset}
                onSubmit={onSubmit}
                onCancel={() => navigate(assetId ? `/assets/${assetId}` : '/dashboard')}
                loading={loading}
              />
            </div>
          ) : (
            <div className="py-20 text-center text-slate-500 font-bold animate-pulse">Loading asset…</div>
          )}
        </div>
      </div>
    </div>
  );
}
