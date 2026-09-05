import { useMemo } from 'react';
import type { FieldDefinition } from '../types/categoryTypes';
import { cn } from '../lib/utils';
import SmartSelect from './SmartSelect';
import { validateCorporateEmail } from '../lib/emailValidation';
import { Upload, Paperclip } from 'lucide-react';

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
          const liveEmailErr =
            isEmailField(field) && value.trim() ? validateCorporateEmail(value) : null;
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
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full input-geometric min-h-[88px]"
                />
                {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
              </div>
            );
          }

          const managed = managedSelects[field.key];
          if (field.type === 'select' && managed) {
            return (
              <div key={field.key} className="space-y-1">
                <SmartSelect
                  label={field.label}
                  required={field.required}
                  value={value}
                  options={managed.options}
                  onChange={(next) => onChange(field.key, next)}
                  onAddCustom={managed.onAddCustom}
                  onDeleteOption={managed.onDeleteOption}
                />
                {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
              </div>
            );
          }

          if (field.type === 'select') {
            return (
              <div key={field.key} className="space-y-1">
                {label}
                <select
                  value={value}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="w-full input-geometric bg-white"
                >
                  <option value="">Select…</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
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
            field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text';

          return (
            <div key={field.key} className="space-y-1">
              {label}
              <input
                type={inputType}
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={
                  isEmailField(field) ? field.placeholder || 'name@company.com' : field.placeholder
                }
                className={cn(
                  'w-full input-geometric',
                  err && isEmailField(field) && 'border-red-400 ring-2 ring-red-500/20'
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
