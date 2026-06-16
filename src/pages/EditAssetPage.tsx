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

  if (user?.role === 'HR') {
    return <Navigate to="/employees" replace />;
  }
  const [loading, setLoading] = useState(false);

  const asset = useMemo(() => {
    const raw = assetId ? findAssetByRouteId(assets, assetId) : undefined;
    return raw ? healMisalignedAssetFields(raw) : undefined;
  }, [assets, assetId]);

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
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-5 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(assetId ? `/assets/${assetId}` : '/dashboard')}
            className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Edit asset</p>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">Edit Asset</h1>
            {asset && (
              <p className="text-sm text-slate-500 mt-1 truncate">
                #{String(asset.id).padStart(3, '0')} — {asset.make} {asset.model}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full px-6 lg:px-10 py-8">
          {asset ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-10">
              <AssetForm
                key={asset.id}
                layout="page"
                initialData={asset}
                onSubmit={onSubmit}
                onCancel={() => navigate(`/assets/${assetId}`)}
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
