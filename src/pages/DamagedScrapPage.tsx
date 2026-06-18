import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Trash2, AlertTriangle, Plus, RefreshCw, Search, CheckCircle2, Wrench, Ban } from 'lucide-react';
import type { DamagedItemRecord } from '../types/redesigned';
import { parseJsonResponse } from '../lib/apiFetch';
import { SYNC_DATABASE_MSG, SYNC_DATABASE_OK, SYNC_DATABASE_ERR } from '../lib/uiLabels';
import { useApp } from '../context/AppProvider';
import MarkDamagedModal from '../components/MarkDamagedModal';
import ConfirmModal from '../components/ConfirmModal';
import { useEmployees } from '../hooks/useEmployees';
import type { AssetFormData } from '../types';
import { assetRouteId, findAssetByAnyId } from '../lib/assetLookup';
import { ViewModeToggle, useListViewMode } from '../components/ViewModeToggle';

export default function DamagedScrapPage() {
  const navigate = useNavigate();
  const { user, assets, handleSubmit } = useApp();

  if (user?.role === 'HR') {
    return <Navigate to="/employees" replace />;
  }
  const { employees } = useEmployees({ autoLoad: true });
  
  const [items, setItems] = useState<DamagedItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DamagedItemRecord['Status']>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [reassigningRecord, setReassigningRecord] = useState<DamagedItemRecord | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [viewMode, setViewMode] = useListViewMode('assetvault.damaged.viewMode', 'grid');
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    confirmBtnClass?: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '';
      const url = force ? '/api/damaged-items?refresh=1' : '/api/damaged-items';
      const res = await fetch(base + url, { credentials: 'include' });
      const data = await parseJsonResponse<{ items?: DamagedItemRecord[] }>(res);
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Load failed');
      setItems(data.items || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load damaged items');
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
        String(it['Asset ID'] || '').toLowerCase().includes(q) ||
        String(it['Asset Name'] || '').toLowerCase().includes(q) ||
        String(it['Damage Reason'] || '').toLowerCase().includes(q) ||
        String(it['Reported By'] || '').toLowerCase().includes(q) ||
        String(it['Remarks'] || '').toLowerCase().includes(q) ||
        String(it['Status'] || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

  const updateStatus = async (record: DamagedItemRecord, nextStatus: DamagedItemRecord['Status']) => {
    try {
      const updatedItem = { ...record, Status: nextStatus };
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ""}/api/damaged-items/${encodeURIComponent(record['Record ID'])}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ item: updatedItem }),
        }
      );
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Update failed');
      toast.success(`Status updated to ${nextStatus}`);
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  const handleStatusChange = async (record: DamagedItemRecord, nextStatus: DamagedItemRecord['Status']) => {
    setConfirmConfig({
      title: 'Change Status',
      message: `Change status of "${record['Asset Name']}" (Asset ID: ${record['Asset ID']}) to "${nextStatus}"?`,
      confirmLabel: 'Confirm',
      onConfirm: async () => {
        setConfirmConfig(null);
        await updateStatus(record, nextStatus);
      },
    });
  };

  const deleteRecord = async (record: DamagedItemRecord) => {
    if (!user?.email) {
      toast.error('Not authenticated');
      return;
    }
    setConfirmConfig({
      title: 'Delete Damaged Record',
      message: `Delete damaged record for "${record['Asset Name']}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      confirmBtnClass: 'bg-red-600 hover:bg-red-700 shadow-red-600/20',
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_BASE_URL || ""}/api/damaged-items/${encodeURIComponent(record['Record ID'])}?userEmail=${encodeURIComponent(user.email)}`,
            { method: 'DELETE', credentials: 'include' }
          );
          const data = await parseJsonResponse(res);
          if (!res.ok) throw new Error((data as { error?: string }).error || 'Delete failed');
          toast.success('Damaged record deleted');
          await load(true);
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Failed to delete');
        }
      },
    });
  };

  const handleRowDeassign = async (record: DamagedItemRecord) => {
    const asset = findAssetByAnyId(assets, record['Asset ID']);
    if (!asset) {
      toast.error('Parent asset not found in database');
      return;
    }
    setConfirmConfig({
      title: 'Deassign Asset',
      message: `Are you sure you want to deassign "${record['Asset Name']}"?`,
      confirmLabel: 'Deassign',
      confirmBtnClass: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20',
      onConfirm: async () => {
        setConfirmConfig(null);
        const updatedAssetFormData: AssetFormData = {
          ...asset,
          employeeId: '',
          contactName: '',
          contactEmail: '',
          contactMobile: '',
          department: '',
          status: 'Available',
        };

        try {
          await handleSubmit(updatedAssetFormData, asset);

          // Also update damaged record status to Deassigned
          const updatedItem = { ...record, Status: 'Deassigned' as const };
          const res = await fetch(
            `${import.meta.env.VITE_API_BASE_URL || ""}/api/damaged-items/${encodeURIComponent(record['Record ID'])}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ item: updatedItem }),
            }
          );
          if (!res.ok) throw new Error('Failed to update log status');

          toast.success('Asset deassigned successfully');
          await load(true);
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Deassign failed');
        }
      },
    });
  };

  const handleRowReassignClick = (record: DamagedItemRecord) => {
    const asset = findAssetByAnyId(assets, record['Asset ID']);
    if (!asset) {
      toast.error('Parent asset not found in database');
      return;
    }
    setReassigningRecord(record);
    setSelectedEmployeeId('');
  };

  const handleReassignSubmit = async () => {
    if (!reassigningRecord) return;
    if (!selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }
    const emp = employees.find((e) => e.employeeId === selectedEmployeeId);
    if (!emp) return;

    const asset = findAssetByAnyId(assets, reassigningRecord['Asset ID']);
    if (!asset) return;

    if (asset.employeeId && asset.employeeId !== selectedEmployeeId) {
      toast.error('Asset already assigned');
      return;
    }

    const updatedAssetFormData: AssetFormData = {
      ...asset,
      employeeId: emp.employeeId,
      contactName: emp.name,
      contactEmail: emp.email,
      contactMobile: emp.phone || '',
      department: emp.department || '',
      status: 'Assigned',
    };

    try {
      await handleSubmit(updatedAssetFormData, asset);
      
      // Also update damaged record status to Reassigned
      const updatedItem = { ...reassigningRecord, Status: 'Reassigned' as const };
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/damaged-items/${encodeURIComponent(reassigningRecord['Record ID'])}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ item: updatedItem }),
      });
      if (!res.ok) throw new Error('Failed to update log status');
      
      toast.success('Asset reassigned successfully');
      setReassigningRecord(null);
      await load(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Reassign failed');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 lg:px-8 py-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Damaged / Scrap</h1>
            <p className="text-sm text-slate-500 mt-1">
              Track and resolve damaged, scrapped, or under-repair assets.
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
                }, { id: 'sync-damaged-items' })
              }
              className={`px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2"
            >
              <Plus size={16} /> Report Damaged
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search asset code, name, reason, reported by…"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold"
          >
            <option value="all">All statuses</option>
            <option value="Reported">Reported</option>
            <option value="In Repair">In Repair</option>
            <option value="Scrapped">Scrapped</option>
            <option value="Repaired">Repaired</option>
            <option value="Deassigned">Deassigned</option>
            <option value="Reassigned">Reassigned</option>
          </select>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 lg:p-8">
        {loading && items.length === 0 ? (
          <p className="text-slate-500 font-bold animate-pulse">Loading records…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-white rounded-2xl border border-slate-200">
            <AlertTriangle className="mx-auto mb-3 text-red-400" size={48} />
            <p className="font-bold">No damaged items recorded</p>
            <p className="text-sm mt-2">Use Report Damaged to register a damaged, scrapping, or repairing asset.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((it) => {
              const asset = findAssetByAnyId(assets, it['Asset ID']);
              const displayCode = asset?.assetCode || it['Asset ID'];
              return (
              <div key={it['Record ID']} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <p className="font-black text-slate-900">{it['Asset Name'] || asset?.assetName || displayCode}</p>
                <p className="text-xs font-mono text-slate-500 mt-1">{displayCode}</p>
                <p className="text-sm text-slate-600 mt-3">{it['Damage Reason'] || '—'}</p>
                <p className="text-xs text-slate-500 mt-2">Reported by {it['Reported By'] || '—'}</p>
                <span className="inline-block mt-3 text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-50 text-red-700">
                  {it.Status}
                </span>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Asset</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Damage Details</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Reported By</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Repair Cost</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Status</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Remarks</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((it) => {
                  const asset = findAssetByAnyId(assets, it['Asset ID']);
                  const handleRowClick = (e: React.MouseEvent) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('a') || target.closest('button')) {
                      return;
                    }
                    if (asset) {
                      navigate(`/assets/${assetRouteId(asset)}`);
                    } else {
                      navigate(`/assets/${encodeURIComponent(it['Asset ID'])}`);
                    }
                  };
                  return (
                    <tr 
                      key={it['Record ID']} 
                      className="hover:bg-slate-100 cursor-pointer transition-colors"
                      onClick={handleRowClick}
                    >
                      <td className="px-4 py-3">
                        {asset ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/assets/${assetRouteId(asset)}`)}
                            className="font-black text-blue-600 hover:underline text-left block"
                          >
                            {it['Asset Name'] || asset.assetName || `Asset #${it['Asset ID']}`}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/assets/${encodeURIComponent(it['Asset ID'])}`)}
                            className="font-black text-blue-600 hover:underline text-left block"
                          >
                            {it['Asset Name'] || `Asset #${it['Asset ID']}`}
                          </button>
                        )}
                        <span className="text-[10px] font-mono text-slate-500">ID: {it['Asset ID']}</span>
                      </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-850">{it['Damage Reason']}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500 font-mono">{it['Damage Date']?.slice(0, 10)}</span>
                        {it['Photo URL'] && (
                          <>
                            <span className="text-slate-300">•</span>
                            <a
                              href={it['Photo URL']}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-red-600 hover:text-red-700 font-bold underline flex items-center gap-0.5"
                            >
                              View Photo
                            </a>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-semibold">{it['Reported By']}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800 font-mono">₹{it['Estimated Cost'] || 0}</p>
                      <span className="text-[10px] font-black text-slate-400 uppercase">
                        Repair: {it['Repair Required'] || 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          it.Status === 'Repaired'
                            ? 'bg-emerald-50 text-emerald-700'
                            : it.Status === 'In Repair'
                              ? 'bg-blue-50 text-blue-700'
                              : it.Status === 'Scrapped'
                                ? 'bg-red-50 text-red-700'
                                : it.Status === 'Deassigned'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : it.Status === 'Reassigned'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                    : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {it.Status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={it['Remarks']}>
                      {it['Remarks'] || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {it.Status === 'Reported' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(it, 'In Repair')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-xs font-black text-blue-700 hover:bg-blue-100"
                            >
                              <Wrench size={12} /> Send to Repair
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(it, 'Scrapped')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-black text-red-700 hover:bg-red-100"
                            >
                              <Ban size={12} /> Scrap
                            </button>
                          </>
                        )}
                        {it.Status === 'In Repair' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(it, 'Repaired')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                            >
                              <CheckCircle2 size={12} /> Mark Repaired
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(it, 'Scrapped')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-black text-red-700 hover:bg-red-100"
                            >
                              <Ban size={12} /> Scrap
                            </button>
                          </>
                        )}
                        {it.Status === 'Repaired' && (
                          <>
                            {(() => {
                              const parentAsset = findAssetByAnyId(assets, it['Asset ID']);
                              const hasAssignee = !!parentAsset?.employeeId;
                              return (
                                <>
                                  {hasAssignee && (
                                    <button
                                      type="button"
                                      onClick={() => handleRowDeassign(it)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs font-black text-amber-700 hover:bg-amber-100"
                                    >
                                      Deassign
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRowReassignClick(it)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-xs font-black text-blue-700 hover:bg-blue-100"
                                  >
                                    Reassign
                                  </button>
                                </>
                              );
                            })()}
                          </>
                        )}
                        {user?.email && (
                          <button
                            type="button"
                            onClick={() => deleteRecord(it)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-black text-red-700 hover:bg-red-100"
                            title="Delete record"
                          >
                            <Trash2 size={12} /> Delete
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

      <MarkDamagedModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          void load(true);
        }}
      />

      {reassigningRecord && (
        <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <h3 className="text-lg font-black text-slate-900 mb-4 font-sans">Reassign Recovered Asset</h3>
            <p className="text-xs text-slate-500 mb-4 font-sans font-medium">
              Select an employee to reassign "{reassigningRecord['Asset Name']}" to.
            </p>
            <div className="space-y-4">
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-sans text-slate-700"
              >
                <option value="">Select Employee...</option>
                {employees.map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.employeeId} - {emp.name} ({emp.department})
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReassigningRecord(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider font-sans"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReassignSubmit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider font-sans shadow-sm"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
    </div>
  );
}
