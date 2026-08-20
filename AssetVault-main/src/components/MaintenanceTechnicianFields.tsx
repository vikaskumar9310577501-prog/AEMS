import { Users } from 'lucide-react';
import {
  buildTechnicianNameSlots,
  MAX_MAINTENANCE_TECHNICIANS,
  validateTechnicians,
} from '../lib/maintenanceTechnicians';

interface MaintenanceTechnicianFieldsProps {
  count: number;
  names: string[];
  disabled?: boolean;
  onCountChange: (count: number) => void;
  onNamesChange: (names: string[]) => void;
}

export default function MaintenanceTechnicianFields({
  count,
  names,
  disabled = false,
  onCountChange,
  onNamesChange,
}: MaintenanceTechnicianFieldsProps) {
  const validationError = validateTechnicians(count, names);
  const slots = buildTechnicianNameSlots(count, names);

  return (
    <div className="mb-4 rounded-xl border border-stone-200/80 bg-white/80 p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <Users size={15} className="text-blue-600 shrink-0" />
        <p className="text-[10px] font-black uppercase tracking-wider text-stone-600">
          People who worked <span className="text-rose-600">required</span>
        </p>
      </div>

      <label className="block text-[10px] font-black uppercase tracking-wider text-stone-500 mb-1">
        How many people?
      </label>
      <select
        value={count}
        disabled={disabled}
        onChange={(e) => onCountChange(Number(e.target.value))}
        className="w-full input-geometric text-sm font-semibold mb-3"
      >
        {Array.from({ length: MAX_MAINTENANCE_TECHNICIANS }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n} person{n === 1 ? '' : 's'}
          </option>
        ))}
      </select>

      <div className="space-y-2">
        {slots.map((value, index) => (
          <div key={index}>
            <label className="block text-[10px] font-black uppercase tracking-wider text-stone-500 mb-1">
              Person {index + 1} name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={value}
              disabled={disabled}
              placeholder={`Enter name of person ${index + 1}`}
              onChange={(e) => {
                const next = [...slots];
                next[index] = e.target.value;
                onNamesChange(next);
              }}
              className="w-full input-geometric text-sm"
            />
          </div>
        ))}
      </div>

      {validationError ? (
        <p className="text-[11px] font-semibold text-rose-600 mt-2">{validationError}</p>
      ) : (
        <p className="text-[11px] text-emerald-700 mt-2">All {count} name{count === 1 ? '' : 's'} entered.</p>
      )}
    </div>
  );
}

export { validateTechnicians };
