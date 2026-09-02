import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  User,
  Clock,
  ArrowRight,
  Eye,
  X,
  FileText,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatStoredDateTime } from '../lib/formatDisplayDate';
import type { AuditLogRecord } from '../types/redesigned';

const PAGE_SIZE = 15;

export default function AuditLogsViewer() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/audit-logs');
      if (!res.ok) throw new Error('Failed to load audit logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error fetching audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Action categories
  const actionCategories = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      const act = String(l.Action || '').trim();
      if (act) set.add(act);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let list = logs;

    if (actionFilter !== 'ALL') {
      list = list.filter((l) => String(l.Action || '').toUpperCase() === actionFilter.toUpperCase());
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (l) =>
          String(l['Log ID'] || '').toLowerCase().includes(q) ||
          String(l['User Email'] || '').toLowerCase().includes(q) ||
          String(l.Action || '').toLowerCase().includes(q) ||
          String(l['Target ID'] || '').toLowerCase().includes(q) ||
          String(l.Remarks || '').toLowerCase().includes(q) ||
          String(l['Date & Time'] || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [logs, actionFilter, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, currentPage]);

  const handleExport = () => {
    try {
      const exportData = filteredLogs.map((l) => ({
        'Log ID': l['Log ID'],
        'Timestamp': l['Date & Time'],
        'User Email': l['User Email'],
        'Action': l.Action,
        'Target ID': l['Target ID'],
        'Remarks': l.Remarks,
        'Old Value': l['Old Value'],
        'New Value': l['New Value'],
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Audit_Logs');
      XLSX.writeFile(wb, `AEMS_Audit_Logs_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Audit logs exported to Excel');
    } catch {
      toast.error('Failed to export Excel');
    }
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('created') || act.includes('add')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('updated') || act.includes('edit')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (act.includes('deassigned') || act.includes('pm') || act.includes('done')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (act.includes('deleted') || act.includes('damaged') || act.includes('scrap')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              System Audit Logs
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono text-[11px] font-bold border border-blue-100">
                {filteredLogs.length} Records
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Immutable historical activity trail of all administrative, user & operational actions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadLogs}
            disabled={loading}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-60 cursor-pointer"
          >
            <Download size={13} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by User, Action, Target ID, Remarks..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
          >
            <option value="ALL">All Actions ({logs.length})</option>
            {actionCategories.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 font-medium">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
            Loading historical audit logs…
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <ShieldCheck size={32} className="mx-auto text-slate-300" />
            <p className="font-bold text-slate-600">No audit logs found</p>
            <p className="text-xs">No records matched your search query or filter criteria.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Log ID</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4">Operation Summary</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLogs.map((log, idx) => (
                    <tr
                      key={log['Log ID'] || idx}
                      className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">
                        {log['Log ID']}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Clock size={12} className="text-slate-400 shrink-0" />
                          <span>{formatStoredDateTime(log['Date & Time'] || '') || log['Date & Time']}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                            {(log['User Email'] || 'U').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-800 truncate max-w-[180px]" title={log['User Email']}>
                            {log['User Email']}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getActionBadgeColor(
                            log.Action || ''
                          )}`}
                        >
                          {log.Action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        {log['Target ID'] || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-[280px] truncate" title={log.Remarks}>
                        {log.Remarks || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                          title="View JSON Diff"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                <span>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} to{' '}
                  {Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} logs
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-2.5 py-1 font-bold text-slate-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">
                    Audit Log Entry #{selectedLog['Log ID']}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {formatStoredDateTime(selectedLog['Date & Time'] || '')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">User Email</span>
                  <span className="font-bold text-slate-800 break-all">{selectedLog['User Email']}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Action</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-black border ${getActionBadgeColor(selectedLog.Action || '')}`}>
                    {selectedLog.Action}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Target Entity</span>
                  <span className="font-mono font-bold text-blue-600">{selectedLog['Target ID']}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Remarks / Operation Summary</span>
                <p className="font-medium text-slate-700 leading-relaxed">{selectedLog.Remarks || 'No remarks provided.'}</p>
              </div>

              {/* Old vs New Values */}
              <div className="space-y-2">
                {selectedLog['Old Value'] && selectedLog['Old Value'] !== '""' && (
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-600 block mb-1">Previous State (Old Value)</span>
                    <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-40 leading-normal">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(selectedLog['Old Value']), null, 2);
                        } catch {
                          return selectedLog['Old Value'];
                        }
                      })()}
                    </pre>
                  </div>
                )}

                {selectedLog['New Value'] && selectedLog['New Value'] !== '""' && (
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-600 block mb-1">Updated State (New Value)</span>
                    <pre className="p-3 bg-slate-900 text-emerald-300 rounded-xl text-[11px] font-mono overflow-x-auto max-h-40 leading-normal">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(selectedLog['New Value']), null, 2);
                        } catch {
                          return selectedLog['New Value'];
                        }
                      })()}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
