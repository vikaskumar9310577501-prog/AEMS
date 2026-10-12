import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Building2,
  CheckCircle2,
  Sparkles,
  Layers,
  Cpu,
  Wrench,
  ShieldCheck,
  Package,
  HardHat,
} from 'lucide-react';
import type { Asset } from '../types';
import type { Employee } from '../types/employee';
import { exportDepartmentToNewAems, isItDepartment } from '../lib/newAemsExport';
import toast from 'react-hot-toast';

export interface DepartmentExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  employees: Employee[];
  initialDepartment?: string;
}

export function DepartmentExportModal({
  isOpen,
  onClose,
  assets,
  employees,
  initialDepartment = 'IT',
}: DepartmentExportModalProps) {
  // Extract all distinct departments and their asset counts
  const departmentStats = useMemo(() => {
    const counts = new Map<string, number>();
    let itCount = 0;

    assets.forEach((a) => {
      const dept = String(a.department || '').trim();
      if (!dept) {
        counts.set('Unassigned', (counts.get('Unassigned') || 0) + 1);
        return;
      }
      counts.set(dept, (counts.get(dept) || 0) + 1);

      if (isItDepartment(dept) || String(a.mainCategory || '').toLowerCase().includes('it')) {
        itCount++;
      }
    });

    const list = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { list, itCount, total: assets.length };
  }, [assets]);

  // Determine initial selection
  const [selectedDept, setSelectedDept] = useState<string>(() => {
    if (initialDepartment && initialDepartment !== 'All') return initialDepartment;
    return 'IT';
  });

  if (!isOpen) return null;

  const isCurrentIt = isItDepartment(selectedDept);
  const isAll = selectedDept === 'ALL';

  // Count of assets for selected department
  const currentCount = useMemo(() => {
    if (isAll) return assets.length;
    if (isCurrentIt) {
      return assets.filter(
        (a) => isItDepartment(a.department || '') || String(a.mainCategory || '').toLowerCase().includes('it')
      ).length;
    }
    return assets.filter((a) => String(a.department || '').trim().toLowerCase() === selectedDept.trim().toLowerCase()).length;
  }, [assets, selectedDept, isAll, isCurrentIt]);

  const handleExport = () => {
    try {
      const res = exportDepartmentToNewAems({
        department: selectedDept,
        assets,
        employees,
      });
      toast.success(`Exported ${res.count} assets for New AEMS! (${res.filename})`, {
        duration: 4000,
        icon: '📥',
      });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to export. Please try again.');
    }
  };

  // Top quick departments
  const quickDepts = [
    { label: 'IT Department', value: 'IT', icon: Cpu, badge: `${departmentStats.itCount}` },
    { label: 'Production', value: 'Production', icon: Layers, badge: `${assets.filter((a) => String(a.department || '').toLowerCase().includes('prod')).length}` },
    { label: 'Maintenance', value: 'Maintenance', icon: Wrench, badge: `${assets.filter((a) => String(a.department || '').toLowerCase().includes('maint')).length}` },
    { label: 'Quality', value: 'Quality', icon: ShieldCheck, badge: `${assets.filter((a) => String(a.department || '').toLowerCase().includes('qual')).length}` },
    { label: 'All Assets', value: 'ALL', icon: Package, badge: `${assets.length}` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-5 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                Export for New AEMS v2
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Smart Importer Format
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Select a department to download the pre-formatted Excel sheet ready for batch import.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all relative z-10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Quick Select Buttons */}
          <div>
            <label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Quick Department Pick
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {quickDepts.map((q) => {
                const Icon = q.icon;
                const isSelected = selectedDept === q.value;
                return (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => setSelectedDept(q.value)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-sm ring-2 ring-blue-500/20 font-bold'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="truncate text-xs">{q.label}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {q.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Department Dropdown */}
          <div>
            <label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5 mb-2">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              Or Choose from All Detected Departments
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white shadow-2xs"
            >
              <option value="ALL">📦 All Departments ({assets.length} total assets)</option>
              <option value="IT">💻 Information Technology (IT) ({departmentStats.itCount} assets)</option>
              <optgroup label="All Specific Departments in Database">
                {departmentStats.list.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.count} assets)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Export Schema Preview Card */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              isCurrentIt
                ? 'bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border-blue-200 text-blue-950'
                : 'bg-gradient-to-br from-amber-50/70 to-orange-50/50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                  isCurrentIt ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'
                }`}
              >
                {isCurrentIt ? <Cpu className="w-5 h-5" /> : <HardHat className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-xs font-black uppercase tracking-wider">
                    {isCurrentIt ? 'IT Technical Batch Template' : 'Industrial Equipment Batch Template'}
                  </h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/80 border border-slate-200 shadow-2xs">
                    {currentCount} Assets Matching
                  </span>
                </div>
                <p className="text-xs mt-1 text-slate-600 font-medium leading-relaxed">
                  {isCurrentIt
                    ? 'Outputs all 23 columns including RAM, SSD, Processor, Hostname, MAC, IP address, and linked Employee Custodian profile details.'
                    : 'Outputs standard 17 columns including Asset Name, Brand, Model, Serial Number, Purchase & PO data, and linked Employee Custodians.'}
                </p>
                <div className="flex items-center gap-3 mt-3 text-[11px] font-bold text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-700 font-extrabold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Auto-links Staff Directory
                  </span>
                  <span>•</span>
                  <span>Includes Guidelines Sheet</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
            Target File: <strong className="text-slate-700">PGEL_{selectedDept.replace(/[^A-Z0-9]/gi, '_')}_Import_Ready.xlsx</strong>
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={currentCount === 0}
              className={`px-5 py-2 rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition-all ${
                currentCount === 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-95'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Export {currentCount} Assets (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
