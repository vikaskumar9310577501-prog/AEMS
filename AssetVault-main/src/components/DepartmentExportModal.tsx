import React, { useState, useMemo, useEffect } from 'react';
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
  MapPin,
  Filter,
} from 'lucide-react';
import type { Asset } from '../types';
import type { Employee } from '../types/employee';
import { exportDepartmentToNewAems, isItDepartment } from '../lib/newAemsExport';
import toast from 'react-hot-toast';

export interface PlantOptionItem {
  code: string;
  name: string;
  location?: string;
}

export interface DepartmentExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  employees: Employee[];
  initialDepartment?: string;
  initialLocation?: string;
  initialPlant?: string;
  locationOptions?: string[];
  plantOptions?: PlantOptionItem[];
}

function normVal(val: unknown): string {
  return String(val ?? '').trim().toLowerCase();
}

function sameVal(left: unknown, right: unknown): boolean {
  return normVal(left) === normVal(right);
}

export function DepartmentExportModal({
  isOpen,
  onClose,
  assets,
  employees,
  initialDepartment = 'IT',
  initialLocation = 'All',
  initialPlant = 'All',
  locationOptions = [],
  plantOptions = [],
}: DepartmentExportModalProps) {
  // Location & Plant filter state
  const [selectedLocation, setSelectedLocation] = useState<string>(() => initialLocation || 'All');
  const [selectedPlant, setSelectedPlant] = useState<string>(() => initialPlant || 'All');

  // Department selection state
  const [selectedDept, setSelectedDept] = useState<string>(() => {
    if (initialDepartment && initialDepartment !== 'All') return initialDepartment;
    return 'IT';
  });

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialLocation) setSelectedLocation(initialLocation);
      if (initialPlant) setSelectedPlant(initialPlant);
      if (initialDepartment && initialDepartment !== 'All') {
        setSelectedDept(initialDepartment);
      } else {
        setSelectedDept('IT');
      }
    }
  }, [isOpen, initialLocation, initialPlant, initialDepartment]);

  // Plants filtered by selected location
  const availablePlants = useMemo(() => {
    if (!plantOptions || plantOptions.length === 0) return [];
    if (selectedLocation === 'All') return plantOptions;
    return plantOptions.filter((p) => !p.location || sameVal(p.location, selectedLocation));
  }, [plantOptions, selectedLocation]);

  // Assets filtered by Location & Plant scope
  const scopedAssets = useMemo(() => {
    return assets.filter((a) => {
      // Location filter
      if (selectedLocation !== 'All' && !sameVal(a.location, selectedLocation)) {
        return false;
      }
      // Plant filter
      if (selectedPlant !== 'All') {
        const matchesCode = sameVal(a.plantCode, selectedPlant);
        const matchesPlantObj = availablePlants.some(
          (p) =>
            (sameVal(p.code, selectedPlant) || sameVal(p.name, selectedPlant)) &&
            (sameVal(a.plantCode, p.code) || sameVal(a.plantCode, p.name))
        );
        if (!matchesCode && !matchesPlantObj) return false;
      }
      return true;
    });
  }, [assets, selectedLocation, selectedPlant, availablePlants]);

  // Extract all distinct departments and their asset counts for scoped assets
  const departmentStats = useMemo(() => {
    const counts = new Map<string, number>();
    let itCount = 0;

    scopedAssets.forEach((a) => {
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

    return { list, itCount, total: scopedAssets.length };
  }, [scopedAssets]);

  const isCurrentIt = isItDepartment(selectedDept);
  const isAll = selectedDept === 'ALL';

  // Count of assets for selected department & scope
  const currentCount = useMemo(() => {
    if (isAll) return scopedAssets.length;
    if (isCurrentIt) {
      return scopedAssets.filter(
        (a) => isItDepartment(a.department || '') || String(a.mainCategory || '').toLowerCase().includes('it')
      ).length;
    }
    return scopedAssets.filter(
      (a) => String(a.department || '').trim().toLowerCase() === selectedDept.trim().toLowerCase()
    ).length;
  }, [scopedAssets, selectedDept, isAll, isCurrentIt]);

  if (!isOpen) return null;

  const handleExport = () => {
    try {
      const res = exportDepartmentToNewAems({
        department: selectedDept,
        assets: scopedAssets,
        employees,
        location: selectedLocation,
        plant: selectedPlant,
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
    {
      label: 'Production',
      value: 'Production',
      icon: Layers,
      badge: `${scopedAssets.filter((a) => String(a.department || '').toLowerCase().includes('prod')).length}`,
    },
    {
      label: 'Maintenance',
      value: 'Maintenance',
      icon: Wrench,
      badge: `${scopedAssets.filter((a) => String(a.department || '').toLowerCase().includes('maint')).length}`,
    },
    {
      label: 'Quality',
      value: 'Quality',
      icon: ShieldCheck,
      badge: `${scopedAssets.filter((a) => String(a.department || '').toLowerCase().includes('qual')).length}`,
    },
    { label: 'All Assets', value: 'ALL', icon: Package, badge: `${scopedAssets.length}` },
  ];

  const targetFilenamePreview = `PGEL_${(isAll ? 'ALL' : selectedDept).replace(/[^A-Za-z0-9]/g, '_')}${
    selectedLocation !== 'All' ? `_${selectedLocation.replace(/[^A-Za-z0-9]/g, '_')}` : ''
  }${selectedPlant !== 'All' ? `_${selectedPlant.replace(/[^A-Za-z0-9]/g, '_')}` : ''}_Import_Ready.xlsx`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
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
                Filter by Location, Plant, and Department for targeted batch import.
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
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Location & Plant Scope Filter */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
                  Location & Plant Filter
                </span>
              </div>
              {selectedLocation !== 'All' || selectedPlant !== 'All' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLocation('All');
                    setSelectedPlant('All');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 transition-colors uppercase tracking-wider underline cursor-pointer"
                >
                  Reset to All
                </button>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  All Plants Included
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Location Select */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-black text-slate-400">Location</span>
                <select
                  value={selectedLocation}
                  onChange={(e) => {
                    setSelectedLocation(e.target.value);
                    setSelectedPlant('All');
                  }}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
                >
                  <option value="All">All Locations</option>
                  {(locationOptions || []).map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plant Select */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-black text-slate-400">Plant / Plant Code</span>
                <select
                  value={selectedPlant}
                  onChange={(e) => setSelectedPlant(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
                >
                  <option value="All">All Plants</option>
                  {availablePlants.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span>
                Matching Pool: <strong className="text-slate-900">{scopedAssets.length} total assets</strong> in{' '}
                {selectedLocation !== 'All' ? selectedLocation : 'All Locations'} ·{' '}
                {selectedPlant !== 'All' ? selectedPlant : 'All Plants'}
              </span>
            </div>
          </div>

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
              className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white shadow-2xs cursor-pointer"
            >
              <option value="ALL">📦 All Departments ({scopedAssets.length} total assets in selected scope)</option>
              <option value="IT">💻 Information Technology (IT) ({departmentStats.itCount} assets)</option>
              <optgroup label="All Specific Departments in Scope">
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
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/80 border border-slate-200 shadow-2xs text-slate-800">
                    {currentCount} Assets Matching
                  </span>
                </div>
                <p className="text-xs mt-1 text-slate-600 font-medium leading-relaxed">
                  {isCurrentIt
                    ? 'Outputs all 23 columns including RAM, SSD, Processor, Hostname, MAC, IP address, and linked Employee Custodians.'
                    : 'Outputs standard 17 columns including Asset Name, Brand, Model, Serial Number, Purchase & PO data, and linked Employee Custodians.'}
                </p>
                <div className="flex items-center gap-3 mt-3 text-[11px] font-bold text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1 text-emerald-700 font-extrabold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Auto-links Staff Directory
                  </span>
                  <span>•</span>
                  <span>Includes Guidelines Sheet</span>
                  <span>•</span>
                  <span className="text-blue-700 font-extrabold">
                    {selectedPlant !== 'All' ? `Plant: ${selectedPlant}` : 'All Plants'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 font-medium hidden sm:block truncate max-w-xs" title={targetFilenamePreview}>
            File: <strong className="text-slate-700">{targetFilenamePreview}</strong>
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
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 active:scale-95'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>
                {currentCount === 0
                  ? 'No Assets in Filter'
                  : `Export ${currentCount} Assets (.xlsx)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
