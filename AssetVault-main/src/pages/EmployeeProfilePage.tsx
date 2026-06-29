import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Building2, MapPin, Package, History, AlertTriangle, Wrench, RotateCcw, Trash2 } from 'lucide-react';
import type { MissingItemRecord } from '../types/redesigned';
import { assetRouteId, findAssetByAnyId } from '../lib/assetLookup';
import { MISSING_ITEMS_FEATURE_ENABLED } from '../lib/features';
import { useApp } from '../context/AppProvider';
import { useEmployees } from '../hooks/useEmployees';
import { assetsForEmployee } from '../lib/employeeAssets';
import { employeeStatusLabel, isInactiveEmployee } from '../lib/employeeStatus';
import AssetTable from '../components/AssetTable';
import type { AssignmentHistoryEntry, Employee } from '../types/employee';
import { normalizeEmployeeId } from '../lib/employeeLookup';
import { parseJsonResponse } from '../lib/apiFetch';
import CreateEmployeeModal from '../components/CreateEmployeeModal';
import { toast } from 'react-hot-toast';

export default function EmployeeProfilePage() {
  const { employeeId: routeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { assets, user, fetchAssets, deassignAsset } = useApp();
  const { employees, loading, refresh } = useEmployees();
  
  const [fetchedEmployee, setFetchedEmployee] = useState<Employee | null>(null);
  const [fetchingOne, setFetchingOne] = useState(false);
  const [history, setHistory] = useState<AssignmentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [missingItems, setMissingItems] = useState<MissingItemRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deassigningAssetId, setDeassigningAssetId] = useState<string | null>(null);


  const isAdmin = user?.role === 'IT Admin' || user?.role === 'Admin';
  const isHr = user?.role === 'HR';
  const canView = isAdmin || isHr;
  const canDelete = user?.role === 'IT Admin';

  const handleDelete = async () => {
    if (!employee) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/employees/${encodeURIComponent(employee.employeeId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success('Employee profile deleted');
      setDeleteConfirmOpen(false);
      navigate('/employees');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDeassignAsset = async (asset: (typeof assets)[number]) => {
    if (!window.confirm(`Deassign "${asset.assetName || asset.assetCode || asset.id}" from ${employee?.name || 'this employee'}?`)) {
      return;
    }
    const assetKey = String(asset.id || asset.assetCode || asset.uniqueCode || '');
    setDeassigningAssetId(assetKey);
    try {
      await deassignAsset(asset, {
        updatedBy: user?.email || user?.role || 'System',
        remarks: `Asset returned / deassigned from employee profile ${employee?.employeeId || ''}`.trim(),
      });
      toast.success('Asset deassigned');
      await fetchAssets({ silent: true, force: true });
      fetchHistory();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to deassign asset');
    } finally {
      setDeassigningAssetId(null);
    }
  };

  const employee = useMemo(() => {
    const id = decodeURIComponent(routeId || '');
    return (
      employees.find((e) => normalizeEmployeeId(e.employeeId) === normalizeEmployeeId(id)) ||
      fetchedEmployee
    );
  }, [employees, routeId, fetchedEmployee]);

  useEffect(() => {
    if (!routeId) return;
    const id = decodeURIComponent(routeId);
    const inList = employees.some((e) => normalizeEmployeeId(e.employeeId) === normalizeEmployeeId(id));
    if (inList) {
      setFetchedEmployee(null);
      return;
    }
    setFetchingOne(true);
    fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/employees/${encodeURIComponent(id)}`)
      .then((r) => parseJsonResponse<{ employee?: Employee }>(r))
      .then((data) => setFetchedEmployee(data.employee || null))
      .catch(() => setFetchedEmployee(null))
      .finally(() => setFetchingOne(false));
  }, [routeId, employees]);

  const assignedAssets = useMemo(() => {
    if (!employee) return [];
    return assetsForEmployee(assets, employee).filter(
      (a) => a.status !== 'Damaged' && a.status !== 'Scrap' && a.status !== 'Lost'
    );
  }, [assets, employee]);

  const damagedAssets = useMemo(() => {
    if (!employee) return [];
    return assetsForEmployee(assets, employee).filter((a) => a.status === 'Damaged');
  }, [assets, employee]);

  const returnedHistory = useMemo(
    () => history.filter((h) => h.action === 'Return'),
    [history]
  );

  const timeline = useMemo(() => {
    interface TimelineEvent {
      date: string;
      label: string;
      kind: string;
      assetId?: string;
      parentAssetId?: string;
      itemName?: string;
    }
    const events: TimelineEvent[] = [];
    for (const h of history) {
      events.push({
        date: h.returnedDate || h.assignedDate || '',
        label: `${h.action} — Asset #${h.assetId}`,
        kind: h.action,
        assetId: String(h.assetId || ''),
      });
    }
    if (MISSING_ITEMS_FEATURE_ENABLED) for (const m of missingItems) {
      // Event for when it was marked missing
      events.push({
        date: m['Missing Date'] || '',
        label: `${m['Missing Item Name']} marked missing (parent #${m['Parent Asset ID'] || 'Standalone'})`,
        kind: 'Missing',
        parentAssetId: m['Parent Asset ID'] || '',
        itemName: m['Missing Item Name'],
      });

      // Events for recovery/deassignment/reassignment history
      if (m.Status === 'Recovered') {
        events.push({
          date: m['Recovered Date'] || m['Missing Date'] || '',
          label: `${m['Missing Item Name']} recovered (by ${m['Recovered By'] || 'System'})`,
          kind: 'Recovered',
          parentAssetId: m['Parent Asset ID'] || '',
          itemName: m['Missing Item Name'],
        });
      } else if (m.Status === 'Deassigned') {
        events.push({
          date: m['Recovered Date'] || m['Missing Date'] || '',
          label: `${m['Missing Item Name']} deassigned from the asset`,
          kind: 'Deassigned',
          parentAssetId: m['Parent Asset ID'] || '',
          itemName: m['Missing Item Name'],
        });
      } else if (m.Status === 'Reassigned') {
        events.push({
          date: m['Recovered Date'] || m['Missing Date'] || '',
          label: `${m['Missing Item Name']} reassigned to another employee`,
          kind: 'Reassigned',
          parentAssetId: m['Parent Asset ID'] || '',
          itemName: m['Missing Item Name'],
        });
      }
    }
    return events.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [history, missingItems]);

  const activeMissingComponents = useMemo(() => {
    if (!MISSING_ITEMS_FEATURE_ENABLED) return [];
    return missingItems.filter((m) => m.Status === 'Missing');
  }, [missingItems]);

  useEffect(() => {
    if (!employee) return;
    if (!MISSING_ITEMS_FEATURE_ENABLED) {
      setMissingItems([]);
      return;
    }
    fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/missing-items')
      .then((r) => parseJsonResponse<{ items?: MissingItemRecord[] }>(r))
      .then((data) => {
        const name = employee.name.toLowerCase();
        const id = employee.employeeId.toUpperCase();
        setMissingItems(
          (data.items || []).filter(
            (m) =>
              m['Employee ID'] === employee.employeeId ||
              (m['Assigned Person']?.toLowerCase().includes(name) ||
                m['Assigned Person']?.toUpperCase().includes(id))
          )
        );
      })
      .catch(() => setMissingItems([]));
  }, [employee?.employeeId, employee?.name]);

  const fetchHistory = () => {
    if (!routeId) return;
    setHistoryLoading(true);
    fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/employees/${encodeURIComponent(routeId)}/history`)
      .then(async (r) => {
        if (!r.ok) return { history: [] as AssignmentHistoryEntry[] };
        return parseJsonResponse<{ history?: AssignmentHistoryEntry[] }>(r);
      })
      .then((data) => setHistory(data.history || []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, [routeId]);

  if (!canView) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!loading && !fetchingOne && !employee) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-black text-slate-900">Employee not found</h2>
          <p className="text-sm text-slate-500 mt-2">Add them from the Employees page or check the ID.</p>
          <button type="button" onClick={() => navigate('/employees')} className="mt-6 btn-primary-geometric">
            Back to employees
          </button>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500 font-bold animate-pulse">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-5 shrink-0">
        <div className="flex items-center justify-between gap-4 mb-4">
          <button
            type="button"
            onClick={() => navigate('/employees')}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600"
          >
            <ArrowLeft size={18} /> All employees
          </button>
          <div className="flex items-center gap-2">
            {!isHr && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Edit profile
              </button>
            )}
            {canDelete && !isHr && (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                Delete profile
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-black shrink-0">
              {employee.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 font-mono">
                {employee.employeeId}
              </p>
              <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{employee.name}</h1>
              <p className="text-sm text-slate-500 mt-1">{employee.designation || '—'} · {employee.department}</p>
              <span
                className={`inline-block mt-2 text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  isInactiveEmployee(employee.status)
                    ? 'bg-red-50 text-red-700 border border-red-100'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {employeeStatusLabel(employee.status)}
              </span>
              {isInactiveEmployee(employee.status) && (
                <p className="text-xs font-bold text-red-600 mt-2">
                  Inactive — no new assets can be assigned. Existing assets can be returned only.
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-[200px]">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
              <p className="text-[10px] font-black uppercase text-blue-600">Assigned assets</p>
              <p className="text-3xl font-black text-blue-800 mt-1">{assignedAssets.length}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-[10px] font-black uppercase text-slate-500">History records</p>
              <p className="text-3xl font-black text-slate-800 mt-1">{history.length}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 lg:p-10 space-y-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoCard icon={Mail} label="Email" value={employee.email} />
          <InfoCard icon={Phone} label="Phone" value={employee.phone || '—'} />
          <InfoCard icon={Building2} label="Department" value={employee.department || '—'} />
          <InfoCard icon={MapPin} label="Location" value={employee.location || '—'} />
          <InfoCard icon={MapPin} label="Plant code" value={employee.plant || '—'} />
        </div>

        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Package size={20} className="text-blue-600" />
              Current active assets ({assignedAssets.length})
            </h2>
          </div>
          {assignedAssets.length === 0 ? (
            <p className="text-slate-500 text-sm py-8 text-center bg-white rounded-2xl border border-slate-200">
              No assets are currently linked to this employee ID or email.
            </p>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Asset Code</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Asset Details</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Category</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Location</th>
                    {!isHr && (
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignedAssets.map((asset) => (
                    <tr key={asset.id || asset.uniqueCode} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-mono text-sm font-bold text-blue-700">
                        {asset.uniqueCode || asset.assetCode || asset.id}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-black text-slate-900 text-sm">{asset.assetName || `${asset.make || ''} ${asset.model || ''}`.trim() || 'Unknown'}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{asset.serialNumber || '—'}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 font-bold uppercase">{asset.mainCategory}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{asset.location}</td>
                      {!isHr && (
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => void handleDeassignAsset(asset)}
                            disabled={deassigningAssetId === String(asset.id || asset.assetCode || asset.uniqueCode || '')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs font-black text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          >
                            <RotateCcw size={14} />
                            {deassigningAssetId === String(asset.id || asset.assetCode || asset.uniqueCode || '') ? 'Deassigning...' : 'Deassign'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {MISSING_ITEMS_FEATURE_ENABLED && activeMissingComponents.length > 0 && (
          <section>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
              <AlertTriangle size={20} className="text-amber-600" />
              Missing components ({activeMissingComponents.length})
            </h2>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl divide-y divide-amber-100">
              {activeMissingComponents.map((m) => {
                const parentAsset = findAssetByAnyId(assets, m['Parent Asset ID']);
                return (
                  <div key={m['Record ID']} className="p-4 flex flex-wrap justify-between gap-2 items-center">
                    <div>
                      <p className="font-black text-slate-900">{m['Missing Item Name']}</p>
                      <p className="text-xs text-slate-600">
                        With asset{' '}
                        {parentAsset ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/assets/${assetRouteId(parentAsset)}`)}
                            className="font-bold text-blue-600 hover:underline inline"
                          >
                            #{m['Parent Asset ID']} {parentAsset.assetName ? `(${parentAsset.assetName})` : ''}
                          </button>
                        ) : m['Parent Asset ID'] ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/assets/${encodeURIComponent(m['Parent Asset ID'])}`)}
                            className="font-bold text-blue-600 hover:underline inline"
                          >
                            #{m['Parent Asset ID']}
                          </button>
                        ) : (
                          'Standalone'
                        )}{' '}
                        · {m['Missing Date']?.slice(0, 10)}
                      </p>
                    </div>
                    <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded h-fit">
                      Missing
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {damagedAssets.length > 0 && (
          <section>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
              <Wrench size={20} className="text-red-600" />
              Damaged assets ({damagedAssets.length})
            </h2>
            <AssetTable
              assets={damagedAssets}
              onEdit={(a) => navigate(`/assets/${assetRouteId(a)}/edit`)}
              onDelete={() => {}}
              onViewQR={() => {}}
              onViewAsset={(a) => navigate(`/assets/${assetRouteId(a)}`)}
              role={user?.role}
            />
          </section>
        )}

        {returnedHistory.length > 0 && (
          <section>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
              <RotateCcw size={20} className="text-slate-600" />
              Returned ({returnedHistory.length})
            </h2>
            <ul className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
              {returnedHistory.map((h) => {
                const asset = findAssetByAnyId(assets, h.assetId);
                return (
                  <li key={h.id} className="px-4 py-3 text-sm flex justify-between items-center">
                    {asset ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/assets/${assetRouteId(asset)}`)}
                        className="font-bold text-blue-600 hover:underline text-left"
                      >
                        Asset #{h.assetId} {asset.assetName ? `(${asset.assetName})` : ''}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/assets/${encodeURIComponent(h.assetId)}`)}
                        className="font-bold text-blue-600 hover:underline text-left"
                      >
                        Asset #{h.assetId}
                      </button>
                    )}
                    <span className="font-mono text-xs text-slate-500">{h.assignedDate}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
            <History size={20} className="text-blue-600" />
            Complete asset timeline
          </h2>
          {timeline.length === 0 && !historyLoading ? (
            <p className="text-slate-500 text-sm py-6 text-center bg-white rounded-2xl border border-slate-200">
              No timeline events yet.
            </p>
          ) : (
            <ol className="relative border-l-2 border-blue-200 ml-3 pl-4 space-y-4 pb-2">
              {timeline.map((ev, i) => {
                const targetAssetId = ev.assetId || ev.parentAssetId;
                const asset = targetAssetId
                  ? findAssetByAnyId(assets, targetAssetId)
                  : undefined;
                return (
                  <li key={i} className="ml-6">
                    <span className="absolute -left-[7px] w-3 h-3 rounded-full bg-blue-500" />
                    <p className="text-[10px] font-mono text-slate-500">{ev.date?.slice(0, 10) || '—'}</p>
                    <div className="text-sm font-bold text-slate-800 flex flex-wrap gap-1 items-center">
                      {ev.kind === 'Missing' || ev.kind === 'Recovered' || ev.kind === 'Deassigned' || ev.kind === 'Reassigned' ? (
                        <>
                          <span>{ev.itemName} {ev.kind === 'Missing' ? 'marked missing' : ev.kind === 'Recovered' ? 'recovered' : ev.kind === 'Deassigned' ? 'deassigned from the asset' : 'reassigned to another employee'}</span>
                          {ev.parentAssetId && (
                            <>
                              <span className="text-slate-400 font-normal">(parent</span>
                              {asset ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/assets/${assetRouteId(asset)}`)}
                                  className="text-blue-600 hover:underline inline font-bold"
                                >
                                  #{ev.parentAssetId} {asset.assetName ? `(${asset.assetName})` : ''}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/assets/${encodeURIComponent(ev.parentAssetId)}`)}
                                  className="text-blue-600 hover:underline inline font-bold"
                                >
                                  #{ev.parentAssetId}
                                </button>
                              )}
                              <span className="text-slate-400 font-normal">)</span>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <span>{ev.kind} —</span>
                          {ev.assetId ? (
                            asset ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/assets/${assetRouteId(asset)}`)}
                                className="text-blue-600 hover:underline inline font-bold"
                              >
                                Asset #{ev.assetId} {asset.assetName ? `(${asset.assetName})` : ''}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => navigate(`/assets/${encodeURIComponent(ev.assetId)}`)}
                                className="text-blue-600 hover:underline inline font-bold"
                              >
                                Asset #{ev.assetId}
                              </button>
                            )
                          ) : (
                            <span>Asset</span>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

      </div>

      <CreateEmployeeModal
        open={modalOpen}
        mode="edit"
        initial={employee}
        onClose={() => setModalOpen(false)}
        onSaved={async (emp) => {
          setModalOpen(false);
          setFetchedEmployee(emp);
          await refresh(true);
        }}
      />

      {/* Delete Confirm Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <h3 className="text-lg font-black text-slate-900 mb-2">Delete Employee</h3>
            <p className="text-slate-600 text-sm mb-6">
              Are you sure you want to delete employee profile <b>{employee.name}</b> ({employee.employeeId})? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3">
      <Icon className="text-blue-500 shrink-0" size={18} />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-800 truncate">{value}</p>
      </div>
    </div>
  );
}
