import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Eye, LayoutGrid, List, Settings2 } from 'lucide-react';

export type ListViewMode = 'grid' | 'table';

export function useListViewMode(storageKey: string, defaultMode: ListViewMode = 'grid') {
  const [viewMode, setViewMode] = useState<ListViewMode>(() => {
    if (typeof window === 'undefined') return defaultMode;
    const saved = window.localStorage.getItem(storageKey);
    return saved === 'grid' || saved === 'table' ? saved : defaultMode;
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, viewMode);
  }, [storageKey, viewMode]);

  return [viewMode, setViewMode] as const;
}

export function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ListViewMode;
  onChange: (mode: ListViewMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const options: { key: ListViewMode; label: string; icon: typeof List }[] = [
    { key: 'grid', label: 'Grid View', icon: Eye },
    { key: 'table', label: 'Table View', icon: List },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold flex items-center gap-2"
      >
        <Settings2 size={14} /> View
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = viewMode === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon size={14} />
                {opt.label}
                {active && <CheckCircle2 size={14} className="ml-auto text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GridEmptyState({ message }: { message: string }) {
  return (
    <div className="col-span-full text-center py-16 text-slate-500 bg-white rounded-2xl border border-slate-200">
      <LayoutGrid className="mx-auto mb-3 opacity-40" size={48} />
      <p className="font-bold">{message}</p>
    </div>
  );
}
