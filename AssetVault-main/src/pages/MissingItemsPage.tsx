import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Plus, RefreshCw, Search, CheckCircle2, Trash2, X, ExternalLink, UserCircle } from 'lucide-react';
import type { MissingItemRecord } from '../types/redesigned';
import type { Asset } from '../types';
import { parseJsonResponse } from '../lib/apiFetch';
import { SYNC_DATABASE_MSG, SYNC_DATABASE_OK, SYNC_DATABASE_ERR } from '../lib/uiLabels';
import { useApp } from '../context/AppProvider';
import MarkMissingModal from '../components/MarkMissingModal';
import ReassignMissingModal from '../components/ReassignMissingModal';
import ConfirmModal from '../components/ConfirmModal';
import { assetRouteId, findAssetByAnyId } from '../lib/assetLookup';
import { ViewModeToggle, useListViewMode } from '../components/ViewModeToggle';

interface MissingItemDetailModalProps {
  record: MissingItemRecord;
  parentAsset?: Asset;
  canDelete: boolean;
  onClose: () => void;
  onOpenParent: () => void;
  onOpenEmployee: () => void;
  onMarkRecovered: () => void;
  onReassign: () => void;
  onDelete: () => void;
}

function MissingItemDetailModal({
  record,
  parentAsset,
  canDelete,
  onClose,
  onOpenParent,
  onOpenEmployee,
  onMarkRecovered,
  onReassign,
  onDelete,
}: MissingItemDetailModalProps) {
  const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800 break-words">{value || '-'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  record.Status === 'Recovered'
                    ? 'bg-emerald-50 text-emerald-700'
                    : record.Status === 'Reassigned'
                      ? 'bg-violet-50 text-violet-700'
                      : 'bg-amber-50 text-amber-800'
                }`}
              >
                {record.Status}
              </span>
              <span className="text-[10px] font-mono font-black text-slate-400">#{record['Record ID']}</span>
            </div>
            <h2 className="mt-2 text-xl font-black text-slate-900">{record['Missing Item Name'] || 'Missing item'}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {[record['Asset Type'], record.Brand, record.Model].filter(Boolean).join(' / ') || 'No item specification'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow label="Parent Asset" value={record['Parent Asset Name'] || parentAsset?.assetName || record['Parent Asset ID']} />
            <InfoRow label="Parent Asset ID" value={record['Parent Asset ID']} />
            <InfoRow label="Employee" value={record['Assigned Person']} />
            <InfoRow label="Employee ID" value={record['Employee ID']} />
            <InfoRow label="Missing Date" value={record['Missing Date']?.slice(0, 10)} />
            <InfoRow label="Recovered Date" value={record['Recovered Date']?.slice(0, 10)} />
            <InfoRow label="Recovered By" value={record['Recovered By']} />
            <InfoRow label="Model" value={record.Model} />
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Remarks</p>
            <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl p-4">
              {record.Remarks || '-'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {record['Parent Asset ID'] && (
              <button
                type="button"
                onClick={onOpenParent}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-black hover:bg-blue-100"
              >
                <ExternalLink size={14} /> Open parent asset
              </button>
            )}
            {record['Employee ID'] && (
              <button
                type="button"
                onClick={onOpenEmployee}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-black hover:bg-slate-200"
              >
                <UserCircle size={14} /> Open employee
              </button>
            )}
            {record.Status === 'Missing' && (
              <button
                type="button"
                onClick={onMarkRecovered}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black hover:bg-emerald-100"
              >
                <CheckCircle2 size={14} /> Mark recovered
              </button>
            )}
            {record.Status === 'Recovered' && (
              <button
                type="button"
                onClick={onReassign}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black hover:bg-indigo-100"
              >
                Reassign
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-black hover:bg-red-100"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MissingItemsPage() {
  const navigate = useNavigate();
  const { user, assets } = useApp();

  if (user?.role === 'HR') {
    return <Navigate to="/employees" replace />;
  }
  const [items, setItems] = useState<MissingItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Missing' | 'Recovered' | 'Reassigned'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedItemForReassign, setSelectedItemForReassign] = useState<MissingItemRecord | null>(null);
  const [detailItem, setDetailItem] = useState<MissingItemRecord | null>(null);

  interface ConfirmConfig {
    title: string;
    message: string;
    confirmLabel: string;
    confirmBtnClass?: string;
    onConfirm: () => void | Promise<void>;
  }
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [viewMode, setViewMode] = useListViewMode('assetvault.missing.viewMode', 'grid');

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '';
      const url = force ? '/api/missing-items?refresh=1' : '/api/missing-items';
      const res = await fetch(base + url, { credentials: 'include' });
      const data = await parseJsonResponse<{ items?: MissingItemRecord[] }>(res);
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Load failed');
      setItems(data.items || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load missing items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((it) => {
      if (statusFilter !== 'all' && it.Status !== statusFilter) return false;
      if (!q) return true;
      return (
        it['Parent Asset ID']?.toLowerCase().includes(q) ||
        it['Parent Asset Name']?.toLowerCase().includes(q) ||
        it['Missing Item Name']?.toLowerCase().includes(q) ||
        it['Asset Type']?.toLowerCase().includes(q) ||
        it['Brand']?.toLowerCase().includes(q) ||
        it['Model']?.toLowerCase().includes(q) ||
        it['Employee ID']?.toLowerCase().includes(q) ||
        it['Assigned Person']?.toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

  const executeMarkRecovered = async (record: MissingItemRecord) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/missing-items/${encodeURIComponent(record['Record ID'])}/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recoveredBy: user?.email || 'Admin' }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Update failed');
      toast.success('Marked as recovered');
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const markRecovered = (record: MissingItemRecord) => {
    setConfirmConfig({
      title: 'Recover Item',
      message: `Mark "${record['Missing Item Name']}" as recovered? Status will change from Missing to Recovered.`,
      confirmLabel: 'Mark Recovered',
      confirmBtnClass: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 text-white rounded-xl px-4 py-2 text-xs font-bold',
      onConfirm: () => {
        setConfirmConfig(null);
        void executeMarkRecovered(record);
      },
    });
  };

  const executeDeleteRecord = async (record: MissingItemRecord) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ""}/api/missing-items/${encodeURIComponent(record['Record ID'])}?userEmail=${encodeURIComponent(user?.email || '')}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Delete failed');
      toast.success('Missing item record deleted');
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const deleteRecord = (record: MissingItemRecord) => {
    if (!user?.email) {
      toast.error('Not authenticated');
      return;
    }
    setConfirmConfig({
      title: 'Delete Record',
      message: `Delete missing item record for "${record['Missing Item Name']}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      confirmBtnClass: 'bg-red-600 hover:bg-red-700 shadow-red-650/20 text-white rounded-xl px-4 py-2 text-xs font-bold',
      onConfirm: () => {
        setConfirmConfig(null);
        void executeDeleteRecord(record);
      },
    });
  };

  const openMissingParentAsset = (record: MissingItemRecord) => {
    const parentAsset = findAssetByAnyId(assets, record['Parent Asset ID']);
    if (parentAsset) {
      navigate(`/assets/${assetRouteId(parentAsset)}`);
    } else if (record['Parent Asset ID']) {
      navigate(`/assets/${encodeURIComponent(record['Parent Asset ID'])}`);
    }
  };

  const openMissingDetail = (record: MissingItemRecord) => {
    setDetailItem(record);
  };


  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 lg:px-8 py-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Missing Items</h1>
            <p className="text-sm text-slate-500 mt-1">
              Track components missing from assigned packages (mouse, charger, etc.)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                toast.promise(load(true), {
                  loading: SYNC_DATABASE_MSG,
                  success: SYNC_DATABASE_OK,
                  error: SYNC_DATABASE_ERR,
                }, { id: 'sync-missing-items' })
              }
              className={`px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2"
            >
              <Plus size={16} /> Missing item
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item, type, brand, employee…"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold"
          >
            <option value="all">All statuses</option>
            <option value="Missing">Missing</option>
            <option value="Recovered">Recovered</option>
            <option value="Reassigned">Reassigned</option>
          </select>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 lg:p-8">
        {loading && items.length === 0 ? (
          <p className="text-slate-500 font-bold animate-pulse">Loading missing records…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-white rounded-2xl border border-slate-200">
            <AlertTriangle className="mx-auto mb-3 text-amber-400" size={48} />
            <p className="font-bold">No missing items recorded</p>
            <p className="text-sm mt-2">Use Missing item to register a lost component with employee details.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((it) => (
              <div
                key={it['Record ID']}
                role="button"
                tabIndex={0}
                onClick={() => openMissingDetail(it)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openMissingDetail(it);
                  }
                }}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-amber-200 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-black text-slate-900">{it['Missing Item Name']}</p>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shrink-0 ${
                      it.Status === 'Recovered'
                        ? 'bg-emerald-50 text-emerald-700'
                        : it.Status === 'Reassigned'
                          ? 'bg-violet-50 text-violet-700'
                          : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {it.Status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">{[it['Asset Type'], it['Brand'], it['Model']].filter(Boolean).join(' · ')}</p>
                <p className="text-xs font-mono text-slate-600 mt-2">{it['Assigned Person'] || it['Employee ID'] || '—'}</p>
                <p className="text-[10px] font-mono text-slate-400 mt-1">{it['Missing Date']?.slice(0, 10) || '—'}</p>
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100">
                  {it.Status === 'Missing' && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); markRecovered(it); }} className="text-xs font-black text-emerald-700">
                      Mark recovered
                    </button>
                  )}
                  {it.Status === 'Recovered' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItemForReassign(it);
                        setReassignModalOpen(true);
                      }}
                      className="text-xs font-black text-indigo-700"
                    >
                      Reassign
                    </button>
                  )}
                  {user?.email && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteRecord(it); }} className="text-xs font-black text-red-600">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Item</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Type / Brand</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Parent asset</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Assigned to</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Date</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Status</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((it) => {
                  const parentAsset = findAssetByAnyId(assets, it['Parent Asset ID']);
                  const handleRowClick = (e: React.MouseEvent) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('a') || target.closest('button')) {
                      return;
                    }
                    openMissingDetail(it);
                  };
                  return (
                    <tr 
                      key={it['Record ID']} 
                      className="hover:bg-slate-100 cursor-pointer transition-colors"
                      onClick={handleRowClick}
                    >
                      <td className="px-4 py-3 font-black text-slate-900">{it['Missing Item Name']}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-bold text-slate-800">{it['Asset Type'] || '—'}</p>
                      {(it['Brand'] || it['Model']) && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {[it['Brand'], it['Model']].filter(Boolean).join(' ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {it['Parent Asset ID'] ? (
                        (() => {
                          const parentAsset = findAssetByAnyId(assets, it['Parent Asset ID']);
                          if (parentAsset) {
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/assets/${assetRouteId(parentAsset)}`)}
                                  className="font-bold text-blue-600 hover:underline text-left"
                                >
                                  {it['Parent Asset Name'] || parentAsset.assetName || it['Parent Asset ID']}
                                </button>
                                <p className="text-[10px] font-mono text-slate-500">#{it['Parent Asset ID']}</p>
                              </>
                            );
                          } else {
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/assets/${encodeURIComponent(it['Parent Asset ID'])}`)}
                                  className="font-bold text-blue-600 hover:underline text-left"
                                >
                                  {it['Parent Asset Name'] || it['Parent Asset ID']}
                                </button>
                                <p className="text-[10px] font-mono text-slate-500">#{it['Parent Asset ID']}</p>
                              </>
                            );
                          }
                        })()
                      ) : (
                        <span className="text-xs font-bold text-slate-400 uppercase">Standalone</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {it['Employee ID'] ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/employees/${encodeURIComponent(it['Employee ID'])}`)}
                          className="font-bold text-blue-600 hover:underline text-left"
                        >
                          {it['Assigned Person'] || it['Employee ID']}
                        </button>
                      ) : (
                        it['Assigned Person'] || '—'
                      )}
                      {it['Employee ID'] && (
                        <p className="text-[10px] font-mono text-slate-500">{it['Employee ID']}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{it['Missing Date']?.slice(0, 10) || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          it.Status === 'Recovered'
                            ? 'bg-emerald-50 text-emerald-700'
                            : it.Status === 'Deassigned'
                            ? 'bg-blue-50 text-blue-700'
                            : it.Status === 'Reassigned'
                            ? 'bg-violet-50 text-violet-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {it.Status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {it.Status === 'Missing' && (
                          <button
                            type="button"
                            onClick={() => markRecovered(it)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                            title="Manually mark this item as recovered"
                          >
                            <CheckCircle2 size={14} /> Mark recovered
                          </button>
                        )}
                        {it.Status === 'Recovered' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItemForReassign(it);
                                setReassignModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                              title="Reassign this item to a new employee"
                            >
                              Reassign
                            </button>
                            <span className="text-[11px] font-bold text-slate-400">
                              Recovered {it['Recovered Date']?.slice(0, 10) || ''}
                            </span>
                          </>
                        )}
                        {it.Status === 'Reassigned' && (
                          <span className="text-xs font-bold text-indigo-605">
                            Reassigned
                          </span>
                        )}
                        {user?.email && (
                          <button
                            type="button"
                            onClick={() => deleteRecord(it)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-black text-red-700 hover:bg-red-100"
                            title="Delete this missing item record"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MarkMissingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          void load(true);
        }}
      />
      <ReassignMissingModal
        open={reassignModalOpen}
        item={selectedItemForReassign}
        onClose={() => {
          setReassignModalOpen(false);
          setSelectedItemForReassign(null);
        }}
        onSaved={() => {
          setReassignModalOpen(false);
          setSelectedItemForReassign(null);
          void load(true);
        }}
      />
      <ConfirmModal
        open={!!confirmConfig}
        title={confirmConfig?.title || ''}
        message={confirmConfig?.message || ''}
        confirmLabel={confirmConfig?.confirmLabel || 'Confirm'}
        confirmBtnClass={confirmConfig?.confirmBtnClass}
        onCancel={() => setConfirmConfig(null)}
        onConfirm={async () => {
          if (confirmConfig) {
            await confirmConfig.onConfirm();
          }
        }}
      />
      {detailItem && (
        <MissingItemDetailModal
          record={detailItem}
          parentAsset={findAssetByAnyId(assets, detailItem['Parent Asset ID'])}
          canDelete={!!user?.email}
          onClose={() => setDetailItem(null)}
          onOpenParent={() => openMissingParentAsset(detailItem)}
          onOpenEmployee={() => {
            if (detailItem['Employee ID']) navigate(`/employees/${encodeURIComponent(detailItem['Employee ID'])}`);
          }}
          onMarkRecovered={() => {
            setDetailItem(null);
            markRecovered(detailItem);
          }}
          onReassign={() => {
            setDetailItem(null);
            setSelectedItemForReassign(detailItem);
            setReassignModalOpen(true);
          }}
          onDelete={() => {
            setDetailItem(null);
            deleteRecord(detailItem);
          }}
        />
      )}
    </div>
  );
}
