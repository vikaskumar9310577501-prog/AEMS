import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { UserPlus, Search, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Employee } from '../types/employee';
import CreateEmployeeModal from './CreateEmployeeModal';
import { parseJsonResponse } from '../lib/apiFetch';
import { cn } from '../lib/utils';
import { isInactiveEmployee, employeeStatusLabel } from '../lib/employeeStatus';
import { validateCorporateEmail } from '../lib/emailValidation';

export interface EmployeeAssignmentValues {
  employeeId: string;
  contactName: string;
  contactEmail: string;
  contactMobile: string;
  department: string;
  location: string;
  plantCode: string;
}

interface EmployeeSelectorProps {
  values: EmployeeAssignmentValues;
  onChange: (patch: Partial<EmployeeAssignmentValues>) => void;
  onEmployeeResolved?: (employee: Employee | null) => void;
  /** Hide department field when captured elsewhere in the form */
  hideDepartmentField?: boolean;
  /** When true, assignee details only come from a saved/created employee profile */
  requireSavedProfile?: boolean;
  /** Show only employee ID lookup + linked profile (hide manual assignee fields) */
  compactLookupOnly?: boolean;
}

function normId(id: string) {
  return id.trim().toUpperCase();
}

function canCreateProfile(values: EmployeeAssignmentValues, requireSavedProfile = false, compactLookupOnly = false) {
  const hasId = !!values.employeeId?.trim();
  const hasEmail = !!values.contactEmail?.trim();
  const hasName = !!values.contactName?.trim();
  if (requireSavedProfile) {
    return compactLookupOnly ? hasId : hasId && hasEmail;
  }
  return hasId && hasName && hasEmail;
}

export default function EmployeeSelector({
  values,
  onChange,
  onEmployeeResolved,
  hideDepartmentField = false,
  requireSavedProfile = false,
  compactLookupOnly = false,
}: EmployeeSelectorProps) {
  const navigate = useNavigate();
  const [lookupLoading, setLookupLoading] = useState(false);
  const [matched, setMatched] = useState<Employee | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [assetCount, setAssetCount] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipLookupRef = useRef(false);

  const applyEmployee = (emp: Employee, count: number | null = null) => {
    setMatched(emp);
    setNotFound(false);
    setAssetCount(count);
    const patch: Partial<EmployeeAssignmentValues> = {
      employeeId: emp.employeeId,
      contactName: emp.name,
      contactEmail: emp.email,
      contactMobile: emp.phone || values.contactMobile,
      location: emp.location || values.location,
      plantCode: emp.plant || values.plantCode,
    };
    if (!hideDepartmentField) {
      patch.department = emp.department || values.department;
    }
    onChange(patch);
    onEmployeeResolved?.(emp);
  };

  const lookup = async (employeeId: string, email: string, active: boolean) => {
    if (skipLookupRef.current) {
      skipLookupRef.current = false;
      return;
    }

    const id = normId(employeeId);
    const em = email.trim().toLowerCase();
    if (em) {
      const emailErr = validateCorporateEmail(em);
      if (emailErr) {
        setEmailError(emailErr);
        return;
      }
    }
    setEmailError(null);
    if (!id && !em) {
      setMatched(null);
      setNotFound(false);
      setAssetCount(null);
      onEmployeeResolved?.(null);
      return;
    }

    setLookupLoading(true);
    try {
      const params = new URLSearchParams();
      if (id) params.set('employeeId', id);
      if (em) params.set('email', em);
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/employees/lookup?${params}`);
      const data = await parseJsonResponse<{ employee?: Employee; assetCount?: number }>(res);
      if (!active) return;
      if (data.employee) {
        applyEmployee(data.employee as Employee, typeof data.assetCount === 'number' ? data.assetCount : null);
      } else {
        setMatched(null);
        setNotFound(true);
        setAssetCount(null);
        onEmployeeResolved?.(null);
      }
    } catch {
      if (!active) return;
      setMatched(null);
      onEmployeeResolved?.(null);
    } finally {
      if (active) {
        setLookupLoading(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void lookup(values.employeeId || '', values.contactEmail || '', active);
    }, 150);
    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [values.employeeId, values.contactEmail]);

  const draftFromForm = (): Partial<Employee> => ({
    employeeId: normId(values.employeeId) || '',
    name: values.contactName,
    email: values.contactEmail,
    phone: values.contactMobile,
    department: values.department,
    location: values.location,
    plant: values.plantCode,
  });

  const onProfileCreated = (emp: Employee) => {
    skipLookupRef.current = true;
    applyEmployee(emp, 0);
    toast.success('Profile ready — view it anytime under Employees', { icon: '✓' });
  };

  const openCreateModal = () => {
    const id = values.employeeId?.trim();
    const email = values.contactEmail?.trim();
    const name = values.contactName?.trim();

    if (requireSavedProfile) {
      if (compactLookupOnly) {
        if (!id) return toast.error('Enter Employee ID first');
      } else if (!id || !email) {
        return toast.error('Enter Employee ID and email first');
      }
      if (email) {
        const emailErr = validateCorporateEmail(email);
        if (emailErr) return toast.error(emailErr);
      }
    } else if (!id || !name || !email) {
      return toast.error('Enter Employee ID, name and email first');
    }

    setCreateModalOpen(true);
  };

  return (
    <>
      <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-black uppercase tracking-widest text-blue-800">Employee mapping</h4>
          <div className="flex items-center gap-2">
            {requireSavedProfile && (
              <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                Saved profile required
              </span>
            )}
            {lookupLoading && (
              <span className="text-[10px] font-bold text-blue-600 animate-pulse">Looking up…</span>
            )}
            {canCreateProfile(values, requireSavedProfile, compactLookupOnly) && !matched && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase rounded-lg"
              >
                <UserPlus size={12} /> Create profile
              </button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="label-caps">Employee ID</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                name="employeeId"
                value={values.employeeId}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  if (matched && normId(val) !== normId(matched.employeeId)) {
                    setMatched(null);
                    setNotFound(false);
                    setAssetCount(null);
                    onEmployeeResolved?.(null);
                    onChange({
                      employeeId: val,
                      contactName: '',
                      contactEmail: '',
                      contactMobile: '',
                      ...(hideDepartmentField ? {} : { department: '' }),
                      location: '',
                      plantCode: '',
                    });
                  } else if (!val.trim()) {
                    setMatched(null);
                    setNotFound(false);
                    setAssetCount(null);
                    onEmployeeResolved?.(null);
                    onChange({
                      employeeId: '',
                      contactName: '',
                      contactEmail: '',
                      contactMobile: '',
                      ...(hideDepartmentField ? {} : { department: '' }),
                      location: '',
                      plantCode: '',
                    });
                  } else {
                    onChange({ employeeId: val });
                  }
                }}
                placeholder="e.g. PGTL001"
                style={{ paddingLeft: '2.5rem' }}
                className="w-full input-geometric pl-10 uppercase"
              />
            </div>
          </div>
          {!compactLookupOnly && (
          <div className="space-y-1.5">
            <label className="label-caps">Corporate email (lookup)</label>
            <input
              type="email"
              name="contactEmail"
              value={values.contactEmail}
              onChange={(e) => {
                const val = e.target.value;
                setEmailError(val.trim() ? validateCorporateEmail(val) : null);
                if (matched && val.trim().toLowerCase() !== (matched.email || '').trim().toLowerCase()) {
                  setMatched(null);
                  setNotFound(false);
                  setAssetCount(null);
                  onEmployeeResolved?.(null);
                  onChange({
                    contactEmail: val,
                    // Keep employeeId intact so it doesn't get wiped and overwritten!
                  });
                } else if (!val.trim()) {
                  setMatched(null);
                  setNotFound(false);
                  setAssetCount(null);
                  onEmployeeResolved?.(null);
                  onChange({
                    contactEmail: '',
                    employeeId: '',
                    contactName: '',
                    contactMobile: '',
                    ...(hideDepartmentField ? {} : { department: '' }),
                    location: '',
                    plantCode: '',
                  });
                } else {
                  onChange({ contactEmail: val });
                }
              }}
              placeholder="name@company.com"
              className="w-full input-geometric"
            />
            {emailError && <p className="text-xs text-red-500 font-bold">{emailError}</p>}
          </div>
          )}
        </div>

        {matched && (
          <div
            className={cn(
              'flex flex-wrap items-start gap-3 p-4 rounded-xl border',
              isInactiveEmployee(matched.status)
                ? 'bg-red-50 border-red-200'
                : 'bg-white border-emerald-200'
            )}
          >
            {isInactiveEmployee(matched.status) ? (
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            ) : (
              <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={20} />
            )}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-[10px] font-black uppercase',
                  isInactiveEmployee(matched.status) ? 'text-red-600' : 'text-emerald-600'
                )}
              >
                {isInactiveEmployee(matched.status) ? 'Inactive profile' : 'Profile linked'}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-slate-900">{matched.name}</p>
                {isInactiveEmployee(matched.status) && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-red-100 text-red-700 rounded border border-red-200">
                    {employeeStatusLabel(matched.status)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {matched.department} · {matched.designation || '—'} · {matched.plant || '—'}
              </p>
              <p className="text-xs text-slate-500 font-mono mt-1">{matched.email}</p>
              {isInactiveEmployee(matched.status) ? (
                <p className="text-xs font-bold text-red-700 mt-2">
                  Cannot assign new assets. Clear assignee fields to return an existing asset.
                </p>
              ) : (
                assetCount !== null && (
                  <p className="text-xs font-bold text-blue-600 mt-2">
                    Currently has {assetCount} asset{assetCount === 1 ? '' : 's'} assigned
                  </p>
                )
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate(`/employees/${encodeURIComponent(matched.employeeId)}`)}
              className="inline-flex items-center gap-1 text-xs font-black uppercase text-blue-600 hover:text-blue-800"
            >
              Open profile <ExternalLink size={12} />
            </button>
          </div>
        )}

        {notFound && (values.employeeId?.trim() || values.contactEmail?.trim()) && !lookupLoading && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
            <div className="flex gap-3">
              <AlertCircle className="text-amber-600 shrink-0" size={20} />
              <p className="text-sm text-amber-950 font-semibold flex-1">
                {requireSavedProfile
                  ? 'No saved employee profile found. Create one below — the asset cannot be registered without it.'
                  : 'Employee code not found. Please enter employee details manually.'}
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase rounded-lg"
            >
              <UserPlus size={14} /> Create employee profile
            </button>
          </div>
        )}

        {!matched && requireSavedProfile && !notFound && !lookupLoading && (
          <p className="text-xs text-slate-600 bg-white/80 rounded-lg px-3 py-2 border border-slate-200">
            {compactLookupOnly ? (
              <>Enter <strong>Employee ID</strong> — the saved profile will be linked automatically.</>
            ) : (
              <>
                Search by <strong>Employee ID</strong> or <strong>email</strong>. If the person is new, enter both and click{' '}
                <strong>Create employee profile</strong> — fill name and other details in the popup.
              </>
            )}
          </p>
        )}

        {!matched && !requireSavedProfile && canCreateProfile(values, false, compactLookupOnly) && !notFound && !lookupLoading && (
          <p className="text-xs text-slate-600 bg-white/80 rounded-lg px-3 py-2 border border-slate-200">
            Tip: Click <strong>Create profile</strong> to save this person in Employees before registering the asset.
          </p>
        )}

        {!compactLookupOnly && (
        <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-blue-100">
          <div className="space-y-1.5">
            <label className="label-caps">Assignee full name *</label>
            <input
              required
              name="contactName"
              value={values.contactName}
              onChange={(e) => onChange({ contactName: e.target.value.toUpperCase() })}
              readOnly={requireSavedProfile && !matched}
              className={cn(
                'w-full input-geometric',
                requireSavedProfile && !matched ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
              )}
              placeholder={requireSavedProfile && !matched ? 'Link employee profile first' : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <label className="label-caps">Contact number *</label>
            <input
              required
              name="contactMobile"
              value={values.contactMobile}
              onChange={(e) => onChange({ contactMobile: e.target.value })}
              readOnly={requireSavedProfile && !matched}
              className={cn(
                'w-full input-geometric',
                requireSavedProfile && !matched ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
              )}
              placeholder={requireSavedProfile && !matched ? 'Link employee profile first' : undefined}
            />
          </div>
          {!hideDepartmentField && (
            <div className="space-y-1.5 md:col-span-2">
              <label className="label-caps">Department</label>
              <input
                name="department"
                value={values.department}
                onChange={(e) => onChange({ department: e.target.value })}
                readOnly={requireSavedProfile && !matched}
                className={cn(
                  'w-full input-geometric',
                  requireSavedProfile && !matched ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
                )}
                placeholder={requireSavedProfile && !matched ? 'Link employee profile first' : undefined}
              />
            </div>
          )}
        </div>
        )}
      </div>

      <CreateEmployeeModal
        open={createModalOpen}
        mode="create"
        initial={draftFromForm()}
        onClose={() => setCreateModalOpen(false)}
        onSaved={onProfileCreated}
      />
    </>
  );
}
