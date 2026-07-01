import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';
import type { Employee } from '../types/employee';
import { EMPTY_EMPLOYEE } from '../types/employee';
import SmartSelect from './SmartSelect';
import { parseJsonResponse } from '../lib/apiFetch';
import { optionsWithValue } from '../lib/formAsset';
import {
  EMPLOYEE_ID_EXISTS_MESSAGE,
  validateEmployeeEmail,
  validateEmployeePhone,
  normalizeEmployeePhoneInput,
} from '../lib/employeeValidation';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface AppSettings {
  locations: string[];
  plants: { code: string; name: string; location: string }[];
  catalog?: { departments?: string[] };
}

interface SettingsSaveResponse {
  success?: boolean;
  settings?: AppSettings;
  error?: string;
}

interface CreateEmployeeModalProps {
  open: boolean;
  initial?: Partial<Employee>;
  onClose: () => void;
  onSaved: (employee: Employee) => void;
  mode?: 'create' | 'edit';
}

function sameSettingValue(left: unknown, right: unknown): boolean {
  return String(left ?? '').trim().toLowerCase() === String(right ?? '').trim().toLowerCase();
}

export default function CreateEmployeeModal({ open, initial, onClose, onSaved, mode }: CreateEmployeeModalProps) {
  const [form, setForm] = useState<Employee>(EMPTY_EMPLOYEE());
  const [saving, setSaving] = useState(false);
  const [employeeIdError, setEmployeeIdError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ locations: [], plants: [] });

  useEffect(() => {
    if (!open) return;
    fetch(`${API_BASE}/api/settings?refresh=1`)
      .then((r) => parseJsonResponse<AppSettings>(r))
      .then(setSettings)
      .catch(() => setSettings({ locations: [], plants: [] }));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setEmployeeIdError(null);
    setForm({
      ...EMPTY_EMPLOYEE(),
      ...initial,
      employeeId: String(initial?.employeeId || '').trim().toUpperCase(),
      phone: normalizeEmployeePhoneInput(String(initial?.phone || '')),
      status: initial?.status === 'Inactive' ? 'Inactive' : 'Active',
    });
  }, [open, initial]);

  const departments = useMemo(() => {
    const fromCatalog = settings.catalog?.departments ?? [];
    return Array.from(new Set([...fromCatalog, form.department].filter(Boolean)));
  }, [settings.catalog?.departments, form.department]);

  const plantsForLocation = useMemo(() => {
    if (!form.location) return settings.plants;
    return settings.plants.filter((p) => !p.location || sameSettingValue(p.location, form.location));
  }, [settings.plants, form.location]);

  if (!open) return null;

  const isEdit = mode ? mode === 'edit' : !!initial?.employeeId;

  const checkEmployeeIdTaken = async (employeeId: string): Promise<boolean> => {
    const id = employeeId.trim();
    if (!id) return false;
    try {
      const res = await fetch(
        `${API_BASE}/api/employees/lookup?employeeId=${encodeURIComponent(id)}`
      );
      const data = await parseJsonResponse<{ employee?: Employee | null }>(res);
      return !!data.employee;
    } catch {
      return false;
    }
  };

  const save = async () => {
    if (!form.employeeId.trim() || !form.name.trim() || !form.email.trim()) {
      return toast.error('Employee ID, name and email are required');
    }
    if (!form.department.trim()) {
      return toast.error('Department is required');
    }

    const emailErr = validateEmployeeEmail(form.email);
    if (emailErr) return toast.error(emailErr);

    const phoneErr = validateEmployeePhone(form.phone);
    if (phoneErr) return toast.error(phoneErr);

    if (!isEdit) {
      const taken = await checkEmployeeIdTaken(form.employeeId);
      if (taken) {
        setEmployeeIdError(EMPLOYEE_ID_EXISTS_MESSAGE);
        return toast.error(EMPLOYEE_ID_EXISTS_MESSAGE);
      }
    }

    setSaving(true);
    try {
      const url = isEdit
        ? `${API_BASE}/api/employees/${encodeURIComponent(form.employeeId)}`
        : `${API_BASE}/api/employees`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, syncSheet: true }),
      });
      const data = await parseJsonResponse<{
        success?: boolean;
        employee?: Employee;
        error?: string;
        sheetWarning?: string;
      }>(res);
      if (!res.ok) {
        if (res.status === 409 || data.error?.toLowerCase().includes('already exists')) {
          setEmployeeIdError(EMPLOYEE_ID_EXISTS_MESSAGE);
        }
        throw new Error(data.error || (res.status === 409 ? EMPLOYEE_ID_EXISTS_MESSAGE : 'Save failed'));
      }
      const saved = (data.employee || form) as Employee;
      if (data.sheetWarning) {
        toast.error(`Profile saved locally. Sheet sync: ${data.sheetWarning}`, { duration: 6000 });
      } else {
        toast.success(isEdit ? 'Employee profile updated' : 'Employee profile created');
      }
      onSaved(saved);
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {isEdit ? 'Edit employee profile' : 'Create employee profile'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {isEdit ? 'Update employee details and active status.' : 'Profile will appear under Employees and link to this asset.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mt-6">
          <div>
            <label className="label-caps block mb-1">Employee ID *</label>
            <input
              value={form.employeeId}
              onChange={(e) => {
                setEmployeeIdError(null);
                setForm((f) => ({ ...f, employeeId: e.target.value.toUpperCase() }));
              }}
              onBlur={() => {
                if (isEdit || !form.employeeId.trim()) return;
                void checkEmployeeIdTaken(form.employeeId).then((taken) => {
                  if (taken) setEmployeeIdError(EMPLOYEE_ID_EXISTS_MESSAGE);
                });
              }}
              placeholder="PGTL001"
              disabled={isEdit}
              className="w-full input-geometric uppercase disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
            {employeeIdError && (
              <p className="text-xs text-red-500 font-bold mt-1">{employeeIdError}</p>
            )}
          </div>
          <div>
            <label className="label-caps block mb-1">Full name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))}
              className="w-full input-geometric"
            />
          </div>
          <div>
            <label className="label-caps block mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="name@pgel.in"
              className="w-full input-geometric"
            />
          </div>
          <div>
            <label className="label-caps block mb-1">Phone</label>
            <input
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: normalizeEmployeePhoneInput(e.target.value) }))
              }
              placeholder="10-digit mobile number"
              className="w-full input-geometric"
            />
          </div>

          <SmartSelect
            label="Department *"
            value={form.department}
            options={optionsWithValue(departments, form.department)}
            onChange={(department) => setForm((f) => ({ ...f, department }))}
            onAddCustom={(newDept) => {
              const deptUpper = newDept.trim().toUpperCase();
              if (deptUpper) {
                const currentDepts = settings.catalog?.departments || [];
                if (!currentDepts.some((dept) => sameSettingValue(dept, deptUpper))) {
                  const nextDepts = [...currentDepts, deptUpper];
                  const nextSettings = {
                    ...settings,
                    catalog: {
                      ...settings.catalog,
                      departments: nextDepts
                    }
                  };
                  setSettings(nextSettings);
                  fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/settings', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ catalog: nextSettings.catalog }),
                  })
                    .then((r) => parseJsonResponse<SettingsSaveResponse>(r))
                    .then((data) => {
                      if (data.settings) {
                        setSettings((prev) => ({
                          ...prev,
                          ...data.settings,
                          catalog: {
                            ...prev.catalog,
                            ...data.settings?.catalog,
                            departments: Array.from(
                              new Set([
                                ...(data.settings?.catalog?.departments || []),
                                deptUpper,
                              ])
                            ),
                          },
                        }));
                      }
                    })
                    .catch((err) => {
                      console.error("Error saving new department:", err);
                      setSettings(prev => ({
                        ...prev,
                        catalog: {
                          ...prev.catalog,
                          departments: nextDepts
                        }
                      }));
                    });
                }
                setForm((f) => ({ ...f, department: deptUpper }));
              }
            }}
            placeholder="Select department"
          />

          <SmartSelect
            label="Location"
            value={form.location}
            options={optionsWithValue(settings.locations, form.location)}
            onChange={(location) => setForm((f) => ({ ...f, location, plant: '' }))}
            placeholder="Select location"
          />

          <SmartSelect
            label="Plant code"
            value={form.plant}
            disabled={!form.location && settings.locations.length > 0}
            options={optionsWithValue(
              plantsForLocation.map((p) => p.code),
              form.plant
            )}
            onChange={(plant) => setForm((f) => ({ ...f, plant }))}
            placeholder={form.location ? 'Select plant' : 'Select location first'}
          />

          <div>
            <label className="label-caps block mb-1">Designation</label>
            <input
              value={form.designation}
              onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
              className="w-full input-geometric"
            />
          </div>

          <div>
            <label className="label-caps block mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Employee['status'] }))}
              className="w-full input-geometric bg-white"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-8 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary-geometric">
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary-geometric">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
