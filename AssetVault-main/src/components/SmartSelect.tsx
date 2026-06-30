import { useEffect, useMemo, useState, useRef } from "react";
import { cn } from "../lib/utils";
import { ChevronDown, Trash2, X } from "lucide-react";

const OTHER = "__OTHER__";

interface SmartSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onAddCustom?: (value: string) => void;
  onDeleteOption?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function SmartSelect({
  label,
  value,
  options,
  onChange,
  onAddCustom,
  onDeleteOption,
  placeholder = "Select…",
  required,
  disabled,
  className,
}: SmartSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const safeOptions = options ?? [];
  const sorted = Array.from(new Set(safeOptions.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );

  const hasAddCustom = typeof onAddCustom === "function";

  const finalOptions = useMemo(() => {
    if (!hasAddCustom && value && !sorted.includes(value)) {
      return [...sorted, value].sort((a, b) => a.localeCompare(b));
    }
    return sorted;
  }, [sorted, value, hasAddCustom]);

  const inList = !!(value && finalOptions.includes(value));

  const [otherMode, setOtherMode] = useState(!inList && !!value && hasAddCustom);
  const [otherText, setOtherText] = useState(!inList && hasAddCustom ? value : "");

  const optionsKey = useMemo(() => finalOptions.join("\0"), [finalOptions]);

  useEffect(() => {
    if (!value) {
      setOtherMode(false);
      setOtherText("");
      return;
    }
    if (otherMode) return;
    const ok = value && finalOptions.includes(value);
    if (ok) {
      setOtherMode(false);
    } else if (value && hasAddCustom) {
      setOtherMode(true);
      setOtherText(value);
    }
  }, [value, optionsKey, finalOptions, hasAddCustom]);

  // Click outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const handleSelect = (v: string) => {
    if (v === OTHER) {
      setOtherMode(true);
      setOtherText(value && !finalOptions.includes(value) ? value : "");
      return;
    }
    setOtherMode(false);
    onChange(v);
  };

  const commitOther = () => {
    const trimmed = otherText.trim();
    if (!trimmed) return;
    onAddCustom?.(trimmed);
    onChange(trimmed);
    setOtherMode(false);
  };

  return (
    <div ref={containerRef} className={cn("space-y-1.5", className)}>
      <label className="label-caps font-black text-xs text-slate-700 font-sans">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {!otherMode ? (
        <div className="relative">
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!disabled) setIsOpen(!isOpen);
              }
            }}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={cn(
              "w-full input-geometric bg-white flex items-center justify-between text-left font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            <span className={cn(!value && "text-slate-400 font-normal")}>
              {value || placeholder}
            </span>
            <span className="flex items-center gap-1 shrink-0 ml-2">
              {value && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                    setIsOpen(false);
                  }}
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Clear selection"
                >
                  <X size={14} />
                </button>
              )}
              <ChevronDown size={16} className="text-slate-400" />
            </span>
          </div>

          {isOpen && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto py-1">
              <div
                onClick={() => {
                  handleSelect("");
                  setIsOpen(false);
                }}
                className="px-4 py-2 text-sm text-slate-400 hover:bg-slate-50 cursor-pointer font-normal"
              >
                {placeholder}
              </div>
              {finalOptions.map((opt) => (
                <div
                  key={opt}
                  className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 cursor-pointer group"
                >
                  <span
                    onClick={() => {
                      handleSelect(opt);
                      setIsOpen(false);
                    }}
                    className="flex-1 text-sm text-slate-700 font-bold"
                  >
                    {opt}
                  </span>
                  {onDeleteOption && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteOption(opt);
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title={`Delete "${opt}"`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              {hasAddCustom && (
                <div
                  onClick={() => {
                    handleSelect(OTHER);
                    setIsOpen(false);
                  }}
                  className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer font-bold border-t border-slate-100"
                >
                  Other (type new)…
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            autoFocus
            type="text"
            value={otherText}
            onChange={(e) => {
              setOtherText(e.target.value);
              onChange(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commitOther())}
            onBlur={commitOther}
            placeholder="Type and press Add"
            className="flex-1 input-geometric"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commitOther}
            className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shrink-0"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setOtherMode(false)}
            className="px-2 text-xs text-slate-500 font-bold"
          >
            List
          </button>
        </div>
      )}
      {value && !otherMode && (
        <p className="text-[10px] text-slate-500 font-medium">Selected: {value}</p>
      )}
    </div>
  );
}
