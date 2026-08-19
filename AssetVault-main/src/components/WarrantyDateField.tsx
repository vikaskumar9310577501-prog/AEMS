import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";
import {
  type DateParts,
  parseStoredDate,
  partsToStored,
} from "../lib/warrantyDate";

export type { DateParts } from "../lib/warrantyDate";
export { parseStoredDate, partsToStored, normalizeWarrantyDate } from "../lib/warrantyDate";

const MONTHS = [
  { v: "", l: "Month" },
  { v: "01", l: "Jan" },
  { v: "02", l: "Feb" },
  { v: "03", l: "Mar" },
  { v: "04", l: "Apr" },
  { v: "05", l: "May" },
  { v: "06", l: "Jun" },
  { v: "07", l: "Jul" },
  { v: "08", l: "Aug" },
  { v: "09", l: "Sep" },
  { v: "10", l: "Oct" },
  { v: "11", l: "Nov" },
  { v: "12", l: "Dec" },
];

const YEARS = ["", ...Array.from({ length: 41 }, (_, i) => String(2010 + i))];
const DAYS = ["", ...Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"))];

function toSortable(parts: DateParts): number | null {
  const y = parts.year.trim();
  if (!y || y.length < 4) return null;
  const stored = partsToStored(parts);
  if (!stored) return null;
  if (/^\d{4}$/.test(stored)) return new Date(`${stored}-01-01`).getTime();
  if (/^\d{4}-\d{2}$/.test(stored)) return new Date(`${stored}-01`).getTime();
  const t = new Date(stored).getTime();
  return Number.isNaN(t) ? null : t;
}

interface WarrantyDateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minFrom?: string;
  error?: string;
}

export default function WarrantyDateField({
  label,
  value,
  onChange,
  minFrom,
  error,
}: WarrantyDateFieldProps) {
  const lastEmittedRef = useRef(value);
  const [parts, setParts] = useState<DateParts>(() => parseStoredDate(value));

  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    setParts(parseStoredDate(value));
  }, [value]);

  const minParts = useMemo(() => (minFrom ? parseStoredDate(minFrom) : null), [minFrom]);

  const update = (patch: Partial<DateParts>) => {
    const next = { ...parts, ...patch };
    setParts(next);

    const stored = partsToStored(next);
    const hasAny = !!(next.year || next.month || next.day);

    if (!stored && hasAny) return;

    if (stored !== lastEmittedRef.current) {
      lastEmittedRef.current = stored;
      onChange(stored);
    } else if (!hasAny && lastEmittedRef.current !== "") {
      lastEmittedRef.current = "";
      onChange("");
    }
  };

  const rangeError = useMemo(() => {
    if (!minParts || !parts.year || parts.year.length < 4) return null;
    const endT = toSortable(parts);
    const startT = toSortable(minParts);
    if (endT === null || startT === null) return null;
    if (endT < startT) return "Cannot be before warranty start";
    return null;
  }, [parts, minParts]);

  const err = error || rangeError;
  const storedPreview = partsToStored(parts);
  const pendingHint =
    (parts.month || parts.day) && !parts.year
      ? "Please enter the year first."
      : null;

  const validYears = useMemo(() => {
    return YEARS.slice(1).filter(y => !minParts || !minParts.year || y >= minParts.year);
  }, [minParts]);

  const validMonths = useMemo(() => {
    return MONTHS.slice(1).filter(m => {
      if (!minParts || !minParts.year || !minParts.month) return true;
      if (parts.year === minParts.year) return m.v >= minParts.month;
      return true;
    });
  }, [minParts, parts.year]);

  const validDays = useMemo(() => {
    return DAYS.slice(1).filter(d => {
      if (!minParts || !minParts.year || !minParts.month || !minParts.day) return true;
      if (parts.year === minParts.year && parts.month === minParts.month) return d >= minParts.day;
      return true;
    });
  }, [minParts, parts.year, parts.month]);

  return (
    <div className="space-y-1.5">
      <label className="label-caps">{label}</label>
      <p className="text-[9px] text-slate-400 -mt-1">
        First <strong>Year</strong>, then Month, then Day (all optional)
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-0.5">
          <span className="text-[8px] font-bold text-slate-400 uppercase">Year</span>
          <select
            value={parts.year}
            onChange={(e) => update({ year: e.target.value })}
            className={cn("input-geometric text-center w-full", err && "border-red-400")}
          >
            <option value="">Year</option>
            {validYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="space-y-0.5">
          <span className="text-[8px] font-bold text-slate-400 uppercase">Month</span>
          <select
            value={parts.month}
            onChange={(e) => update({ month: e.target.value })}
            className={cn("input-geometric w-full", err && "border-red-400")}
          >
            {[{v:"", l:"Month"}, ...validMonths].map((m) => (
              <option key={m.v || "empty"} value={m.v}>
                {m.l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-0.5">
          <span className="text-[8px] font-bold text-slate-400 uppercase">Day</span>
          <select
            value={parts.day}
            onChange={(e) => update({ day: e.target.value })}
            className={cn("input-geometric text-center w-full", err && "border-red-400")}
          >
            <option value="">Day</option>
            {validDays.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
      {pendingHint && (
        <p className="text-[10px] text-amber-600 font-bold">{pendingHint}</p>
      )}
      {err && <p className="text-[10px] text-red-600 font-bold">{err}</p>}
      {storedPreview && (
        <p className="text-[10px] text-green-700 font-mono font-bold">Saved: {storedPreview}</p>
      )}
    </div>
  );
}
