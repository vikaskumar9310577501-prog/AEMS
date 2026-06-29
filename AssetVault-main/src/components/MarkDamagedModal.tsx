import React, { useEffect, useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { X, Search, Check, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppProvider';
import { parseJsonResponse } from '../lib/apiFetch';
import type { DamagedItemRecord } from '../types/redesigned';
import type { Asset } from '../types';

interface MarkDamagedModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function MarkDamagedModal({ open, onClose, onSaved }: MarkDamagedModalProps) {
  const { assets, user } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [damageDate, setDamageDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [damageReason, setDamageReason] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [repairRequired, setRepairRequired] = useState<'Yes' | 'No'>('No');
  const [estimatedCost, setEstimatedCost] = useState('0');
  const [status, setStatus] = useState<DamagedItemRecord['Status']>('Reported');
  const [remarks, setRemarks] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearchQuery('');
    setSelectedAsset(null);
    setDamageDate(new Date().toISOString().slice(0, 10));
    setDamageReason('');
    setReportedBy(user?.email || user?.name || 'System');
    setRepairRequired('No');
    setEstimatedCost('0');
    setStatus('Reported');
    setRemarks('');
    setPhotoUrl('');
    setUploadingPhoto(false);
    setShowDropdown(false);
  }, [open, user]);

  // Filter assets based on search query (by asset ID, code, serial number, make, model)
  const filteredAssets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return assets.filter((a) => {
      return (
        String(a.id || '').toLowerCase().includes(q) ||
        String(a.assetCode || '').toLowerCase().includes(q) ||
        String(a.serialNumber || '').toLowerCase().includes(q) ||
        String(a.make || '').toLowerCase().includes(q) ||
        String(a.model || '').toLowerCase().includes(q)
      );
    }).slice(0, 8); // show top 8 results
  }, [assets, searchQuery]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      try {
        const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, fileData: base64 })
        });
        const data = await res.json();
        if (data.url || data.viewUrl) {
          setPhotoUrl(data.viewUrl || data.url);
          toast.success("Photo uploaded successfully");
        } else if (data.error) {
          toast.error(data.error);
        }
      } catch (err) {
        console.error(err);
        toast.error("Photo upload failed");
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!open) return null;

  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setSearchQuery(asset.assetCode || String(asset.id));
    setShowDropdown(false);
  };

  const handleSave = async () => {
    if (!selectedAsset) {
      return toast.error('Please search and select an asset first');
    }
    if (!damageReason.trim()) {
      return toast.error('Please enter the damage reason');
    }
    const reporter = reportedBy.trim() || user?.email || user?.name || 'System';

    setSaving(true);
    try {
      const displayName = [selectedAsset.make, selectedAsset.model, selectedAsset.assetType]
        .filter(Boolean)
        .join(' ')
        .trim();

      const itemPayload: DamagedItemRecord = {
        'Record ID': '',
        'Asset ID': String(selectedAsset.id),
        'Asset Name': displayName || 'Unknown Asset',
        'Damage Date': damageDate,
        'Damage Reason': damageReason.trim(),
        'Reported By': reporter,
        'Repair Required': repairRequired,
        'Estimated Cost': Number(estimatedCost) || 0,
        Status: status,
        Remarks: remarks.trim(),
        'Photo URL': photoUrl,
      };

      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/damaged-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: itemPayload, syncSheet: true }),
      });
      const data = await parseJsonResponse<{ error?: string; sheetWarning?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Save failed');
      
      if (data.sheetWarning) {
        toast.error(`Saved locally. ${data.sheetWarning}`, { duration: 5000 });
      } else {
        toast.success('Damaged item record created successfully');
      }

      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8 relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-900">Report Damaged / Scrap</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-6">
          Record a damaged asset, specifying the damage details, estimated repair cost, and current status.
        </p>

        <div className="space-y-4">
          {/* Asset Search & Selector */}
          <div className="relative">
            <label className="label-caps block mb-1">Search Asset (ID, Code, Make, Model, SN) *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  if (selectedAsset) setSelectedAsset(null);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Type to search assets..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>

            {/* Autocomplete Dropdown */}
            {showDropdown && filteredAssets.length > 0 && (
              <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto divide-y divide-slate-100">
                {filteredAssets.map((asset) => (
                  <li
                    key={asset.id}
                    onClick={() => handleSelectAsset(asset)}
                    className="px-4 py-3 hover:bg-slate-50 cursor-pointer text-sm flex flex-col gap-0.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">
                        {asset.assetCode || `Asset #${asset.id}`}
                      </span>
                      <span className="text-xs font-black uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {asset.assetType}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 truncate">
                      {[asset.make, asset.model].filter(Boolean).join(' ')} • SN: {asset.serialNumber || 'N/A'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {showDropdown && searchQuery && filteredAssets.length === 0 && !selectedAsset && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-4 text-center text-xs text-slate-500">
                No matching assets found.
              </div>
            )}
          </div>

          {/* Selected Asset Information Card */}
          {selectedAsset && (
            <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl flex items-start gap-3">
              <div className="bg-red-100 text-red-700 p-2 rounded-lg shrink-0">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1 min-w-0 text-sm">
                <h4 className="font-black text-red-900 leading-tight">
                  {[selectedAsset.make, selectedAsset.model].filter(Boolean).join(' ')}
                </h4>
                <p className="text-xs text-red-700 mt-1">
                  <strong>Code:</strong> {selectedAsset.assetCode || 'N/A'} • <strong>SN:</strong> {selectedAsset.serialNumber || 'N/A'}
                </p>
                <p className="text-xs text-red-700 mt-0.5">
                  <strong>Assignee:</strong> {selectedAsset.contactName || 'Unassigned'} ({selectedAsset.employeeId || 'N/A'})
                </p>
                <p className="text-xs text-red-700 mt-0.5">
                  <strong>Category:</strong> {selectedAsset.mainCategory || 'IT Assets'} • {selectedAsset.subCategory || 'Other'}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="label-caps block mb-1">Damage Date *</label>
            <input
              type="date"
              value={damageDate}
              onChange={(e) => setDamageDate(e.target.value)}
              className="w-full input-geometric"
            />
          </div>

          <div>
            <label className="label-caps block mb-1">Damage Reason *</label>
            <input
              value={damageReason}
              onChange={(e) => setDamageReason(e.target.value)}
              placeholder="e.g. Screen cracked, power surge damage..."
              className="w-full input-geometric"
            />
          </div>

          <div className="space-y-1.5 font-mono">
            <label className="label-caps block mb-1">Upload Photo (optional)</label>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                className="flex-1 min-w-[200px] input-geometric file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-red-700"
              />
              {uploadingPhoto && (
                <span className="text-xs text-red-500 font-bold animate-pulse font-sans">Uploading photo…</span>
              )}
              {photoUrl && !uploadingPhoto && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-500 font-bold font-sans">✓ Photo Attached</span>
                  <a
                    href={photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 font-bold underline font-sans"
                  >
                    Preview
                  </a>
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="text-xs text-red-500 hover:text-red-700 font-bold font-sans"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            {photoUrl && (
              <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden max-w-[150px] max-h-[150px]">
                <img src={photoUrl} alt="Damage preview" className="object-cover w-full h-full" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label-caps block mb-1">Repair Required</label>
              <select
                value={repairRequired}
                onChange={(e) => setRepairRequired(e.target.value as 'Yes' | 'No')}
                className="w-full input-geometric font-bold"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div>
              <label className="label-caps block mb-1">Est. Cost (₹)</label>
              <input
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                className="w-full input-geometric font-mono text-right"
              />
            </div>
            <div>
              <label className="label-caps block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DamagedItemRecord['Status'])}
                className="w-full input-geometric font-bold"
              >
                <option value="Reported">Reported</option>
                <option value="In Repair">In Repair</option>
                <option value="Scrapped">Scrapped</option>
                <option value="Repaired">Repaired</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label-caps block mb-1">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Any additional remarks..."
              className="w-full input-geometric min-h-[72px]"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary-geometric">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary-geometric bg-red-600 hover:bg-red-700"
          >
            {saving ? 'Saving…' : 'Save Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
