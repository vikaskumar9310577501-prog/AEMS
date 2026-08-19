import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { MaintenanceMachine } from '../types/maintenance';
import {
  CUSTOM_TREND_MONTHS,
  DEFAULT_MACHINE_TYPES,
  TREND_SELECT_OPTIONS,
  isCustomTrend,
  trendMonthsLabel,
} from '../types/maintenance';
import { normalizeCustomPlanDates, normalizeMachineNumber, allCustomPlanDateStrings, mergeCustomPlan } from '../lib/maintenanceCodes';
import { plantShortName } from '../lib/plantDisplay';
import { toDateInputValue } from '../lib/formatDisplayDate';
import { optionsWithValue } from '../lib/formAsset';
import SmartSelect from './SmartSelect';

type PlantRec = { code: string; name: string; location: string };

export interface MaintenanceMachineEditModalProps {
  machine: MaintenanceMachine | null;
  saving?: boolean;
  machineTypes: string[];
  locations: string[];
  plants: PlantRec[];
  onClose: () => void;
  onSave: (payload: Partial<MaintenanceMachine>) => void | Promise<void>;
}

function sameLoc(a?: string, b?: string) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

export function CustomPlanDatesField({
  dates,
  onChange,
}: {
  dates: string[];
  onChange: (dates: string[]) => void;
}) {
  const add = () => onChange([...dates, '']);
  const setAt = (i: number, value: string) => {
    const next = dates.slice();
    next[i] = value;
    onChange(next);
  };
  const removeAt = (i: number) => onChange(dates.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          Planned PM dates
        </label>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-blue-700 hover:text-blue-900"
        >
          <Plus size={12} /> Add date
        </button>
      </div>
      {dates.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          Add every PM date you want on the dashboard. All dates are kept — nothing is removed when you add more.
        </p>
      ) : (
        <div className="space-y-1.5">
          {dates.map((d, i) => (
            <div key={`custom-date-${i}`} className="flex items-center gap-2">
              <input
                type="date"
                value={d}
                onChange={(e) => setAt(i, e.target.value)}
                className="flex-1 input-geometric text-sm font-semibold"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                aria-label="Remove date"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MaintenanceMachineEditModal({
  machine,
  saving = false,
  machineTypes,
  locations,
  plants,
  onClose,
  onSave,
}: MaintenanceMachineEditModalProps) {
  const [machineType, setMachineType] = useState('');
  const [machineNumber, setMachineNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [location, setLocation] = useState('');
  const [plantCode, setPlantCode] = useState('');
  const [trendMonths, setTrendMonths] = useState(2);
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState('');
  const [status, setStatus] = useState<MaintenanceMachine['status']>('Active');
  const [remarks, setRemarks] = useState('');
  const [customPlanDates, setCustomPlanDates] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!machine) return;
    setMachineType(machine.machineType || '');
    setMachineNumber(machine.machineNumber || '');
    setDepartment(machine.department || '');
    setResponsibility(machine.responsibility || '');
    setLocation(machine.location || '');
    setPlantCode(machine.plantCode || '');
    setTrendMonths(Number(machine.trendMonths) === CUSTOM_TREND_MONTHS ? CUSTOM_TREND_MONTHS : Number(machine.trendMonths) || 2);
    setNextMaintenanceDate(toDateInputValue(machine.nextMaintenanceDate));
    setStatus(machine.status || 'Active');
    setRemarks(machine.remarks || '');
    setCustomPlanDates(allCustomPlanDateStrings(machine));
    setError('');
  }, [machine]);

  const typeOptions = useMemo(
    () => Array.from(new Set([...DEFAULT_MACHINE_TYPES, ...machineTypes, machineType].filter(Boolean))),
    [machineTypes, machineType]
  );

  const plantsForLocation = useMemo(
    () => plants.filter((p) => !location || !p.location || sameLoc(p.location, location)),
    [plants, location]
  );

  const submit = () => {
    if (!machine) return;
    if (!machineType.trim()) return setError('Machine type is required');
    if (!machineNumber.trim()) return setError('Machine number is required');
    if (!location.trim() || !plantCode.trim()) return setError('Location and plant are required');
    const custom = isCustomTrend(trendMonths);
    const merged = custom ? mergeCustomPlan('', normalizeCustomPlanDates(customPlanDates)) : null;
    if (custom && !merged?.nextMaintenanceDate) {
      return setError('At least one planned date is required for Custom frequency');
    }
    if (!custom && !nextMaintenanceDate.trim()) return setError('Next maintenance date is required');
    void onSave({
      machineType: machineType.trim(),
      machineNumber: normalizeMachineNumber(machineNumber),
      department: department.trim(),
      responsibility: responsibility.trim(),
      location: location.trim(),
      plantCode: plantCode.trim(),
      trendMonths,
      nextMaintenanceDate: custom ? merged!.nextMaintenanceDate : nextMaintenanceDate,
      status,
      remarks: remarks.trim(),
      customPlanDates: custom ? merged!.customPlanDates : [],
    });
  };

  return (
    <AnimatePresence>
      {machine && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 font-sans"
          onClick={() => !saving && onClose()}
        >
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 max-w-2xl w-full max-h-[calc(100dvh-2rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Pencil className="text-blue-600" size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Edit machine</h3>
                  <p className="text-xs font-mono font-bold text-blue-700 mt-0.5">{machine.assetCode}</p>
                  <p className="text-[10px] font-semibold text-slate-400">Asset code cannot be changed</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <SmartSelect
                label="Machine Type"
                required
                value={machineType}
                options={optionsWithValue(typeOptions, machineType)}
                onChange={setMachineType}
              />
              <div className="space-y-1.5">
                <label className="label-caps">
                  Machine Number <span className="text-red-500">*</span>
                </label>
                <input
                  value={machineNumber}
                  onChange={(e) => setMachineNumber(e.target.value.toUpperCase())}
                  className="w-full input-geometric uppercase font-mono font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-caps">Department</label>
                <DeptCombo value={department} onChange={setDepartment} />
              </div>
              <div className="space-y-1.5">
                <label className="label-caps">Responsibility</label>
                <input
                  value={responsibility}
                  onChange={(e) => setResponsibility(e.target.value)}
                  className="w-full input-geometric font-semibold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-caps">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MaintenanceMachine['status'])}
                  className="w-full input-geometric bg-white font-semibold"
                >
                  {['Active', 'Maintenance Due', 'Overdue', 'Done', 'Down'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <SmartSelect
                label="Location"
                required
                value={location}
                options={optionsWithValue(locations, location)}
                onChange={(next) => {
                  setLocation(next);
                  if (!plants.some((p) => sameLoc(p.location, next) && p.code === plantCode)) {
                    setPlantCode('');
                  }
                }}
              />
              <div className="space-y-1.5">
                <label className="label-caps">
                  Plant <span className="text-red-500">*</span>
                </label>
                <select
                  value={plantCode}
                  onChange={(e) => setPlantCode(e.target.value)}
                  className="w-full input-geometric bg-white font-bold"
                >
                  <option value="" disabled>
                    Select plant
                  </option>
                  {plantsForLocation.map((p) => (
                    <option key={p.code} value={p.code}>
                      {plantShortName(p.code, plants)}
                    </option>
                  ))}
                  {plantCode && !plantsForLocation.some((p) => p.code === plantCode) ? (
                    <option value={plantCode}>{plantShortName(plantCode, plants)}</option>
                  ) : null}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="label-caps">Frequency</label>
                <select
                  value={trendMonths}
                  onChange={(e) => setTrendMonths(Number(e.target.value))}
                  className="w-full input-geometric bg-white font-bold"
                >
                  {TREND_SELECT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {trendMonthsLabel(n)}
                    </option>
                  ))}
                </select>
              </div>
              {!isCustomTrend(trendMonths) ? (
                <div className="space-y-1.5">
                  <label className="label-caps">
                    Next Maintenance Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={nextMaintenanceDate}
                    onChange={(e) => setNextMaintenanceDate(e.target.value)}
                    className="w-full input-geometric"
                  />
                </div>
              ) : null}
            </div>

            {isCustomTrend(trendMonths) ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] text-amber-900 font-semibold mb-2">
                  Manual plan — add every PM date below. All dates appear on the dashboard and in the machines list.
                </p>
                <CustomPlanDatesField dates={customPlanDates} onChange={setCustomPlanDates} />
              </div>
            ) : null}

            <div className="mt-3 space-y-1.5">
              <label className="label-caps">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="w-full input-geometric"
              />
            </div>

            {error ? <p className="text-xs font-bold text-red-600 mt-3">{error}</p> : null}

            <div className="flex gap-3 justify-end mt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-bold text-white rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const DEPT_PRESETS = [
  'Production',
  'Maintenance',
  'Quality',
  'Stores',
  'Packing',
  'Assembly',
  'Dispatch',
  'Utility',
  'Admin',
  'IT',
  'HR',
  'Finance',
  'Purchase',
  'Safety',
  'R&D',
];

const CUSTOM_DEPTS_KEY = 'aems_custom_departments';

function getCustomDepts(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_DEPTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomDept(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = getCustomDepts();
  if (DEPT_PRESETS.includes(trimmed) || existing.includes(trimmed)) return;
  localStorage.setItem(CUSTOM_DEPTS_KEY, JSON.stringify([...existing, trimmed]));
}

export function DeptCombo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [customDepts, setCustomDepts] = useState<string[]>(getCustomDepts);
  const allDepts = [...DEPT_PRESETS, ...customDepts];
  const isOther = value !== '' && !allDepts.includes(value);
  const [showCustom, setShowCustom] = useState(isOther);
  const [customInput, setCustomInput] = useState(isOther ? value : '');

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === '__other__') {
      setShowCustom(true);
      setCustomInput('');
      onChange('');
    } else {
      setShowCustom(false);
      onChange(v);
    }
  };

  const handleAdd = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    saveCustomDept(trimmed);
    setCustomDepts(getCustomDepts());
    setShowCustom(false);
    onChange(trimmed);
  };

  const selectValue = showCustom ? '__other__' : (value || '');

  return (
    <div className="space-y-1.5">
      <select
        value={selectValue}
        onChange={handleSelect}
        className="w-full input-geometric bg-white font-semibold"
      >
        <option value="">— Select Department —</option>
        {allDepts.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
        <option value="__other__">+ Add New Department</option>
      </select>
      {showCustom && (
        <div className="flex gap-2">
          <input
            autoFocus
            placeholder="Type department name…"
            value={customInput}
            onChange={(e) => { setCustomInput(e.target.value); onChange(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            className="w-full input-geometric font-semibold"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
