import { useMemo, useState, useEffect } from 'react';
import type { FieldDefinition } from '../types/categoryTypes';
import { cn } from '../lib/utils';
import SmartSelect from './SmartSelect';
import { validateCorporateEmail } from '../lib/emailValidation';
import { Paperclip } from 'lucide-react';

export interface ManagedSelectConfig {
  options: string[];
  onAddCustom?: (value: string) => void;
  onDeleteOption?: (value: string) => void;
}

export interface DynamicAssetFormProps {
  fields: FieldDefinition[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  errors?: Record<string, string>;
  className?: string;
  title?: string;
  managedSelects?: Record<string, ManagedSelectConfig>;
}

function isEmailField(field: FieldDefinition): boolean {
  return field.type === 'email' || field.key.toLowerCase().includes('email');
}

export default function DynamicAssetForm({
  fields,
  values,
  onChange,
  errors = {},
  className,
  title = 'Type-specific details',
  managedSelects = {},
}: DynamicAssetFormProps) {
  // Local persistence for user-added / user-deleted dropdown options per field key
  const [customOptionsMap, setCustomOptionsMap] = useState<Record<string, string[]>>(() => {
    try {
      const stored = localStorage.getItem('aems_dynamic_custom_select_options');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [deletedOptionsMap, setDeletedOptionsMap] = useState<Record<string, string[]>>(() => {
    try {
      const stored = localStorage.getItem('aems_dynamic_deleted_select_options');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const handleAddCustomOption = (key: string, newOption: string) => {
    const trimmed = newOption.trim().toUpperCase();
    if (!trimmed) return;
    setCustomOptionsMap((prev) => {
      const existing = prev[key] || [];
      if (existing.includes(trimmed)) return prev;
      const updated = { ...prev, [key]: [...existing, trimmed] };
      try {
        localStorage.setItem('aems_dynamic_custom_select_options', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    // If it was previously deleted, un-delete it
    setDeletedOptionsMap((prev) => {
      const existing = prev[key] || [];
      if (!existing.includes(trimmed)) return prev;
      const updated = { ...prev, [key]: existing.filter((o) => o !== trimmed) };
      try {
        localStorage.setItem('aems_dynamic_deleted_select_options', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleDeleteOption = (key: string, optionToDelete: string) => {
    setDeletedOptionsMap((prev) => {
      const existing = prev[key] || [];
      if (existing.includes(optionToDelete)) return prev;
      const updated = { ...prev, [key]: [...existing, optionToDelete] };
      try {
        localStorage.setItem('aems_dynamic_deleted_select_options', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setCustomOptionsMap((prev) => {
      const existing = prev[key] || [];
      if (!existing.includes(optionToDelete)) return prev;
      const updated = { ...prev, [key]: existing.filter((o) => o !== optionToDelete) };
      try {
        localStorage.setItem('aems_dynamic_custom_select_options', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (values[key] === optionToDelete) {
      onChange(key, '');
    }
  };

  const activeFields = useMemo(() => {
    return fields
      .filter((f) => f.active !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [fields]);

  if (!activeFields.length) return null;

  return (
    <section className={cn('space-y-4', className)}>
      <h3 className="label-caps flex items-center gap-2 text-blue-600">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeFields.map((field) => {
          const value = values[field.key] ?? '';
          const isEmail = isEmailField(field);
          const liveEmailErr =
            isEmail && value.trim() ? validateCorporateEmail(value) : null;
          const err = errors[field.key] || liveEmailErr || undefined;
          const label = (
            <label className="label-caps block mb-1.5">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
          );

          if (field.type === 'textarea') {
            return (
              <div key={field.key} className="md:col-span-2 space-y-1">
                {label}
                <textarea
                  value={value}
                  onChange={(e) => {
                    const nextVal = isEmail ? e.target.value : e.target.value.toUpperCase();
                    onChange(field.key, nextVal);
                  }}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full input-geometric min-h-[88px] uppercase"
                />
                {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
              </div>
            );
          }

          if (field.type === 'select') {
            const managed = managedSelects[field.key];
            const baseOptions = managed?.options || field.options || [];
            const customOptions = customOptionsMap[field.key] || [];
            const deletedOptions = deletedOptionsMap[field.key] || [];
            const allOptions = Array.from(new Set([...baseOptions, ...customOptions])).filter(
              (opt) => !deletedOptions.includes(opt)
            );

            return (
              <div key={field.key} className="space-y-1">
                <SmartSelect
                  label={field.label}
                  required={field.required}
                  value={value}
                  options={allOptions}
                  onChange={(next) => onChange(field.key, isEmail ? next : next.toUpperCase())}
                  onAddCustom={(newOpt) => {
                    const upper = isEmail ? newOpt : newOpt.toUpperCase();
                    handleAddCustomOption(field.key, upper);
                    managed?.onAddCustom?.(upper);
                  }}
                  onDeleteOption={(opt) => {
                    handleDeleteOption(field.key, opt);
                    managed?.onDeleteOption?.(opt);
                  }}
                  transformValue={(v) => (isEmail ? v : v.toUpperCase())}
                />
                {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
              </div>
            );
          }

          if (field.type === 'checkbox') {
            return (
              <div key={field.key} className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  checked={value === 'Yes' || value === 'true'}
                  onChange={(e) => onChange(field.key, e.target.checked ? 'Yes' : 'No')}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                {label}
                {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
              </div>
            );
          }

          if (field.type === 'file') {
            return (
              <div key={field.key} className="space-y-1">
                {label}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    placeholder="URL or document link"
                    className="flex-1 input-geometric text-xs"
                  />
                  <label className="btn-secondary-geometric cursor-pointer flex items-center gap-1.5 text-xs py-2 px-3 shrink-0">
                    <Paperclip size={13} />
                    <span>Upload</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              onChange(field.key, reader.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
                {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
              </div>
            );
          }

          const inputType =
            field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : isEmail ? 'email' : 'text';

          return (
            <div key={field.key} className="space-y-1">
              {label}
              <input
                type={inputType}
                value={value}
                onChange={(e) => {
                  const nextVal = isEmail || field.type === 'date' || field.type === 'number'
                    ? e.target.value
                    : e.target.value.toUpperCase();
                  onChange(field.key, nextVal);
                }}
                placeholder={
                  isEmail ? field.placeholder || 'name@company.com' : field.placeholder
                }
                className={cn(
                  'w-full input-geometric',
                  !isEmail && field.type !== 'date' && field.type !== 'number' && 'uppercase font-bold',
                  err && isEmail && 'border-red-400 ring-2 ring-red-500/20'
                )}
              />
              {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Validate required dynamic fields */
export function validateDynamicFields(
  fields: FieldDefinition[],
  values: Record<string, string>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.active === false) continue;
    const val = String(values[f.key] ?? '').trim();
    if (f.required && !val) {
      errors[f.key] = `${f.label} is required`;
      continue;
    }
    if (val && isEmailField(f)) {
      const emailErr = validateCorporateEmail(val);
      if (emailErr) errors[f.key] = emailErr;
    }
  }
  return errors;
}
