import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Download, Building2, MapPin, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { MaintenanceMachine } from '../types/maintenance';
import { plantShortName, plantTableLabel } from '../lib/plantDisplay';
import { daysUntilDate, effectiveNextMaintenanceDate } from '../lib/maintenanceCodes';
import { toDisplayDateInput } from '../lib/formatDisplayDate';

interface ThisMonthPmModalProps {
  isOpen: boolean;
  onClose: () => void;
  machines: MaintenanceMachine[];
  plants: { code: string; name: string; location: string }[];
  initialMonthOffset?: number; // 0 = this month, 1 = next month, -1 = previous month
}

function getMonthRange(offset = 0): { start: Date; end: Date; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offset;
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const label = start.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return { start, end, label };
}

function statusBadge(machine: MaintenanceMachine): { label: string; className: string } {
  const days = daysUntilDate(effectiveNextMaintenanceDate(machine));
  if (days == null) return { label: 'SCHEDULED', className: 'bg-slate-100 text-slate-700' };
  if (days < 0) {
    return {
      label: `${Math.abs(days)}d OVERDUE`,
      className: 'bg-red-50 text-red-700 border border-red-200 font-bold',
    };
  }
  if (days <= 7) {
    return {
      label: `${days}d LEFT`,
      className: 'bg-amber-50 text-amber-700 border border-amber-200 font-bold',
    };
  }
  return {
    label: 'ON TRACK',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold',
  };
}

export default function ThisMonthPmModal({
  isOpen,
  onClose,
  machines,
  plants,
  initialMonthOffset = 0,
}: ThisMonthPmModalProps) {
  const [monthOffset, setMonthOffset] = useState(initialMonthOffset);
  const [search, setSearch] = useState('');

  const monthRange = useMemo(() => getMonthRange(monthOffset), [monthOffset]);

  const monthMachines = useMemo(() => {
    return machines.filter((m) => {
      const nextDateStr = effectiveNextMaintenanceDate(m);
      if (!nextDateStr) return false;
      const d = new Date(nextDateStr);
      if (isNaN(d.getTime())) return false;
      return d >= monthRange.start && d <= monthRange.end;
    });
  }, [machines, monthRange]);

  const filteredMachines = useMemo(() => {
    if (!search.trim()) return monthMachines;
    const q = search.trim().toLowerCase();
    return monthMachines.filter(
      (m) =>
        (m.equipmentName && m.equipmentName.toLowerCase().includes(q)) ||
        m.machineType.toLowerCase().includes(q) ||
        m.machineNumber.toLowerCase().includes(q) ||
        (m.assetCode && m.assetCode.toLowerCase().includes(q)) ||
        (m.serialNumber && m.serialNumber.toLowerCase().includes(q)) ||
        (m.modelNumber && m.modelNumber.toLowerCase().includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q)) ||
        (m.responsibility && m.responsibility.toLowerCase().includes(q))
    );
  }, [monthMachines, search]);

  const handleExport = () => {
    const data = filteredMachines.map((m) => ({
      'Machine Name': m.equipmentName?.trim() || `${m.machineType} ${m.machineNumber}`.trim(),
      'Machine Code': m.assetCode || '',
      'Serial Number': m.serialNumber || '',
      'Model Number': m.modelNumber || '',
      Plant: plantTableLabel(m.plantCode, plants),
      Location: m.location || '',
      Department: m.department || '',
      'Next PM Date': m.nextMaintenanceDate || '',
      'PM Status': statusBadge(m).label,
      Responsibility: m.responsibility || '',
      'Warranty Status': m.warrantyStatus || '',
      'Warranty Valid Till': m.warrantyExpiryDate || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PM_Due_Machines');
    XLSX.writeFile(wb, `AEMS_PM_Due_${monthRange.label.replace(/\s+/g, '_')}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-900 to-indigo-950 text-white flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-200 border border-white/20">
                <Calendar size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black tracking-tight">Preventive Maintenance Due</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-100 border border-blue-400/30 text-xs font-bold font-mono">
                    {monthRange.label}
                  </span>
                </div>
                <p className="text-xs text-blue-200/80 font-medium">
                  Machines scheduled for preventive maintenance during this period
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-black tracking-wide shadow-md shadow-emerald-900/30 border border-emerald-400">
                Total Machines Due: {monthMachines.length}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            {/* Dynamic Month Tabs */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
              <button
                type="button"
                onClick={() => setMonthOffset(-1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  monthOffset === -1 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Previous Month
              </button>
              <button
                type="button"
                onClick={() => setMonthOffset(0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  monthOffset === 0 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setMonthOffset(1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  monthOffset === 1 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Next Month
              </button>
            </div>

            {/* Search & Export */}
            <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search machine, serial, code..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors shrink-0"
              >
                <Download size={13} />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto p-4">
            {filteredMachines.length === 0 ? (
              <div className="text-center py-16 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Calendar size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No machines scheduled for PM in {monthRange.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">Try selecting a different month or clearing your search query.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                      <th className="px-3.5 py-3">Machine</th>
                      <th className="px-3 py-3">Machine Code</th>
                      <th className="px-3 py-3">Serial Number</th>
                      <th className="px-3 py-3">Model Number</th>
                      <th className="px-3 py-3">Plant</th>
                      <th className="px-3 py-3">Department</th>
                      <th className="px-3 py-3">Next PM</th>
                      <th className="px-3 py-3 text-center">PM Status</th>
                      <th className="px-3 py-3">Responsibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredMachines.map((m, idx) => {
                      const badge = statusBadge(m);
                      const machineName = m.equipmentName?.trim() || `${m.machineType} ${m.machineNumber}`.trim();
                      const dueDate = effectiveNextMaintenanceDate(m);
                      return (
                        <tr
                          key={m.id || idx}
                          className="hover:bg-blue-50/60 transition-colors group font-medium"
                        >
                          <td className="px-3.5 py-2.5 font-bold text-slate-900">
                            {machineName}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-blue-700">
                            {m.assetCode || '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-slate-700">
                            {m.serialNumber || (
                              <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                Missing
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-700">
                            {m.modelNumber || (
                              <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                Missing
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800">
                            <span className="inline-flex items-center gap-1">
                              <Building2 size={12} className="text-slate-400" />
                              {plantShortName(m.plantCode)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{m.department || '—'}</td>
                          <td className="px-3 py-2.5 font-bold text-slate-900">
                            {toDisplayDateInput(dueDate) || dueDate || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${badge.className}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{m.responsibility || 'Unassigned'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filteredMachines.length} of {monthMachines.length} machines due
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
