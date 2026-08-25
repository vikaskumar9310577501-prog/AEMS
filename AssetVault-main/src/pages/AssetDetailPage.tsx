import { useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AssetDetails from '../components/AssetDetails';
import DeleteAssetModal from '../components/DeleteAssetModal';
import { useApp } from '../context/AppProvider';
import { findAssetByRouteId } from '../lib/assetLookup';

export default function AssetDetailPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const { assets, loading, user, executeDelete } = useApp();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const asset = assetId ? findAssetByRouteId(assets, assetId) : undefined;

  const onDelete = () => {
    if (!asset?.id) return;
    executeDelete(asset.id);
    setDeleteOpen(false);
    navigate('/dashboard');
  };

  if (!loading && !asset) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-black text-slate-900">Asset not found</h2>
          <p className="text-sm text-slate-500 mt-2">This asset may have been removed or the link is invalid.</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-6 btn-primary-geometric"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500 font-bold animate-pulse">Loading asset details…</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 shrink-0 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} /> Back to Assets
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24">
        <div className="max-w-5xl mx-auto">
          <AssetDetails
            layout="page"
            asset={asset}
            role={user?.role}
            onEdit={(a) => navigate(`/assets/${assetId}/edit`, { state: { asset: a } })}
            onDelete={() => setDeleteOpen(true)}
          />
        </div>
      </div>

      <DeleteAssetModal open={deleteOpen} onCancel={() => setDeleteOpen(false)} onConfirm={onDelete} />
    </div>
  );
}
