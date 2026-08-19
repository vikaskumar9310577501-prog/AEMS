import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Wrench } from 'lucide-react';
import { useApp } from '../context/AppProvider';
import { parseJsonResponse } from '../lib/apiFetch';
import SmartSelect from '../components/SmartSelect';
import { optionsWithValue } from '../lib/formAsset';
import { buildScopedLocationOptions, buildScopedPlantOptions, sameScopeOption } from '../lib/scopeOptions';
import { normalizeMachineNumber } from '../lib/maintenanceCodes';
import { plantShortName } from '../lib/plantDisplay';
import {
  DEFAULT_MACHINE_TYPES,
  DEFAULT_TREND_MONTHS,
  TREND_SELECT_OPTIONS,
  isCustomTrend,
  trendMonthsLabel,
} from '../types/maintenance';
import { canAddMaintenanceMachine } from '../lib/userPermissions';
import { CustomPlanDatesField } from '../components/MaintenanceMachineEditModal';

export default function NewMaintenanceMachinePage() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [machineTypes, setMachineTypes] = useState<string[]>([...DEFAULT_MACHINE_TYPES]);
  const [previewCode, setPreviewCode] = useState('PM-…');
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [plants, setPlants] = useState<{ code: string; name: string; location: string }[]>([]);
  const [form, setForm] = useState({
    machineType: '',
    machineNumber: '',
    department: '',
    responsibility: '',
    location: '',
    plantCode: '',
    trendMonths: DEFAULT_TREND_MONTHS as number,
    nextMaintenanceDate: '',
    remarks: '',
  });
  const [customPlanDates, setCustomPlanDates] = useState<string[]>([]);

  useEffect(() => {
    if (!user || !canAddMaintenanceMachine(user.role)) return;
    const base = import.meta.env.VITE_API_BASE_URL || '';
    void (async () => {
      try {
        const [machRes, settingsRes, codeRes] = await Promise.all([
          fetch(`${base}/api/maintenance/machines`, { credentials: 'include' }),
          fetch(`${base}/api/settings`, { credentials: 'include' }),
          fetch(`${base}/api/maintenance/machines/next-code`, { credentials: 'include' }),
        ]);
        const machData = await parseJsonResponse<{ machineTypes?: string[] }>(machRes);
        const settingsData = await parseJsonResponse<{
          locations?: string[];
          plants?: { code: string; name: string; location: string }[];
        }>(settingsRes);
        const codeData = await parseJsonResponse<{ code?: string }>(codeRes);
        if (Array.isArray(machData.machineTypes) && machData.machineTypes.length) {
          setMachineTypes(machData.machineTypes);
        }
        setLocations(settingsData.locations || []);
        setPlants(settingsData.plants || []);
        if (codeData.code) setPreviewCode(codeData.code);
      } catch {
        /* keep defaults */
      }
    })();
  }, [user?.role]);

  const allowedLocations = useMemo(
    () => buildScopedLocationOptions(locations, plants, user, [form.location]),
    [locations, plants, user, form.location]
  );

  const allowedPlants = useMemo(
    () =>
      buildScopedPlantOptions(
        plants,
        user,
        form.plantCode ? [{ code: form.plantCode, name: form.plantCode, location: form.location }] : [],
        allowedLocations
      ),
    [plants, user, form.plantCode, form.location, allowedLocations]
  );

  const plantsForLocation = useMemo(
    () =>
      allowedPlants.filter(
        (p) => !form.location || !p.location || sameScopeOption(p.location, form.location)
      ),
    [allowedPlants, form.location]
  );

  if (!user || !canAddMaintenanceMachine(user.role)) {
    return <Navigate to={user?.role === 'HR' ? '/employees' : '/dashboard'} replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.machineType.trim()) return toast.error('Select machine type');
    if (!form.machineNumber.trim()) return toast.error('Enter machine number');
    if (!form.location.trim() || !form.plantCode.trim()) return toast.error('Location and plant are required');
    if (!form.nextMaintenanceDate.trim()) return toast.error('Maintenance date is required');

    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/maintenance/machines`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineType: form.machineType.trim(),
          machineNumber: normalizeMachineNumber(form.machineNumber),
          department: form.department.trim(),
          responsibility: form.responsibility.trim(),
          location: form.location.trim(),
          plantCode: form.plantCode.trim(),
          trendMonths: form.trendMonths,
          customPlanDates: isCustomTrend(form.trendMonths) ? customPlanDates : [],
          nextMaintenanceDate: form.nextMaintenanceDate,
          remarks: form.remarks.trim(),
        }),
      });
      const data = await parseJsonResponse<{ error?: string; machine?: { assetCode?: string } }>(res);
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(`Machine saved · ${data.machine?.assetCode || 'OK'}`);
      navigate('/maintenance');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/maintenance')}
            className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-600"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Maintenance</p>
            <h1 className="text-2xl font-black text-slate-900">Register Machine</h1>
          </div>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 space-y-6 shadow-sm">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Wrench className="text-blue-700" size={18} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Auto asset code</p>
              <p className="text-lg font-mono font-black text-blue-700">{previewCode}</p>
            </div>
          </div>

          <SmartSelect
            label="Machine Type"
            required
            value={form.machineType}
            options={optionsWithValue(machineTypes, form.machineType)}
            onChange={(machineType) => setForm((prev) => ({ ...prev, machineType }))}
            onAddCustom={async (name) => {
              const trimmed = name.trim();
              if (!trimmed) return;
              setForm((prev) => ({ ...prev, machineType: trimmed }));
              setMachineTypes((prev) =>
                Array.from(new Set([...prev, trimmed])).sort((a, b) => a.localeCompare(b))
              );
              try {
                await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/maintenance/machine-types`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: trimmed }),
                });
              } catch {
                /* still usable locally */
              }
            }}
          />

          <div className="space-y-1.5">
            <label className="label-caps">
              Machine Number <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.machineNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, machineNumber: e.target.value.toUpperCase() }))}
              placeholder="e.g. M01"
              className="w-full input-geometric uppercase font-mono font-bold"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="label-caps">Department</label>
              <input
                value={form.department}
                onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                placeholder="e.g. Production"
                className="w-full input-geometric font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="label-caps">Responsibility</label>
              <input
                value={form.responsibility}
                onChange={(e) => setForm((prev) => ({ ...prev, responsibility: e.target.value }))}
                placeholder="e.g. Shift In-charge name"
                className="w-full input-geometric font-semibold"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <SmartSelect
              label="Location"
              required
              value={form.location}
              options={optionsWithValue(allowedLocations, form.location)}
              onChange={(location) => setForm((prev) => ({ ...prev, location, plantCode: '' }))}
            />
            {form.location ? (
              <div className="space-y-1.5">
                <label className="label-caps">
                  Plant <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.plantCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, plantCode: e.target.value }))}
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
                </select>
              </div>
            ) : (
              <div className="space-y-1.5 opacity-50">
                <label className="label-caps">Plant</label>
                <div className="input-geometric bg-slate-100 text-slate-400">Select location first</div>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="label-caps">
                Maintenance Trend <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.trendMonths}
                onChange={(e) => setForm((prev) => ({ ...prev, trendMonths: Number(e.target.value) }))}
                className="w-full input-geometric bg-white font-bold"
              >
                {TREND_SELECT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {trendMonthsLabel(n)}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-500">
                {isCustomTrend(form.trendMonths)
                  ? 'Custom — no auto interval. Next date is the current due. Extra dates you add after that appear on the dashboard as a manual plan.'
                  : `After each Done, next date auto-suggests +${form.trendMonths} month${form.trendMonths === 1 ? '' : 's'} (${trendMonthsLabel(form.trendMonths)}). Change anytime from Machines list.`}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="label-caps">
                Next Maintenance Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.nextMaintenanceDate}
                onChange={(e) => setForm((prev) => ({ ...prev, nextMaintenanceDate: e.target.value }))}
                className="w-full input-geometric"
              />
            </div>
          </div>

          {isCustomTrend(form.trendMonths) ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <CustomPlanDatesField dates={customPlanDates} onChange={setCustomPlanDates} />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="label-caps">Remarks (optional)</label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
              rows={3}
              className="w-full input-geometric"
              placeholder="Notes about this machine"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/maintenance')}
              className="btn-secondary-geometric"
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary-geometric disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Machine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
