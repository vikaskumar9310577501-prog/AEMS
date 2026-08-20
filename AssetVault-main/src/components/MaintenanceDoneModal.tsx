import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, X } from 'lucide-react';
import type { MaintenanceMachine } from '../types/maintenance';
import { isCustomTrend, trendMonthsLabel } from '../types/maintenance';
import { suggestNextMaintenanceDate, machineTrendMonths, pendingPlanDates } from '../lib/maintenanceCodes';
import { plantShortName } from '../lib/plantDisplay';
import type { MaintenanceTechnicianPayload } from '../lib/maintenanceTechnicians';
import { buildTechnicianNameSlots, validateTechnicians } from '../lib/maintenanceTechnicians';
import MaintenanceTechnicianFields from './MaintenanceTechnicianFields';

export type MaintenanceDonePayload = {
  nextMaintenanceDate: string;
} & MaintenanceTechnicianPayload;

interface MaintenanceDoneModalProps {
  machine: MaintenanceMachine | null;
  plants?: { code: string; name: string; location?: string }[];
  saving?: boolean;
  onClose: () => void;
  onConfirm: (payload: MaintenanceDonePayload) => void | Promise<void>;
}

export default function MaintenanceDoneModal({
  machine,
  plants,
  saving = false,
  onClose,
  onConfirm,
}: MaintenanceDoneModalProps) {
  const [nextDate, setNextDate] = useState('');
  const [error, setError] = useState('');
  const [technicianCount, setTechnicianCount] = useState(1);
  const [technicianNames, setTechnicianNames] = useState<string[]>(['']);
  const custom = machine ? isCustomTrend(machineTrendMonths(machine)) : false;

  useEffect(() => {
    if (machine) {
      const trend = machineTrendMonths(machine);
      if (isCustomTrend(trend)) {
        const pending = pendingPlanDates(machine);
        const next = pending[1];
        setNextDate(
          next
            ? `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
            : ''
        );
      } else {
        setNextDate(suggestNextMaintenanceDate(new Date(), trend));
      }
      setError('');
      setTechnicianCount(1);
      setTechnicianNames(['']);
    }
  }, [machine]);

  const onCountChange = (count: number) => {
    setTechnicianCount(count);
    setTechnicianNames(buildTechnicianNameSlots(count, technicianNames));
  };

  const techniciansOk = !validateTechnicians(technicianCount, technicianNames);

  const submit = () => {
    const trimmed = nextDate.trim();
    const pending = machine ? pendingPlanDates(machine) : [];
    const canAutoAdvance = custom && pending.length > 1;
    if (!trimmed) {
      if (canAutoAdvance) {
        if (!techniciansOk) {
          setError(validateTechnicians(technicianCount, technicianNames) || 'Enter all technician names');
          return;
        }
        void onConfirm({
          nextMaintenanceDate: '',
          technicianCount,
          technicianNames: technicianNames.map((n) => n.trim()),
        });
        return;
      }
      setError('Next maintenance date is required');
      return;
    }
    const d = new Date(`${trimmed}T00:00:00`);
    if (Number.isNaN(d.getTime())) {
      setError('Enter a valid date (YYYY-MM-DD)');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const min = new Date(today);
    min.setDate(min.getDate() + 8);
    if (d < min) {
      setError('Date must be more than 7 days from today');
      return;
    }
    if (!techniciansOk) {
      setError(validateTechnicians(technicianCount, technicianNames) || 'Enter all technician names');
      return;
    }
    void onConfirm({
      nextMaintenanceDate: trimmed,
      technicianCount,
      technicianNames: technicianNames.map((n) => n.trim()),
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
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full max-h-[min(92vh,760px)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="text-emerald-600" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Mark maintenance Done</h3>
                  <p className="text-xs font-mono font-bold text-blue-700 mt-0.5">{machine.assetCode}</p>
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

            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              {machine.machineType} · {machine.machineNumber} · {plantShortName(machine.plantCode, plants)}
              <br />
              {custom ? (
                <>
                  Trend: <strong>Custom (manual dates)</strong>. The next planned date will advance automatically if
                  more dates are already set. You can also enter a new date — must be more than 7 days from today unless
                  it is already on your plan.
                </>
              ) : (
                <>
                  Trend: <strong>{trendMonthsLabel(machineTrendMonths(machine))}</strong>. Next date pre-filled from trend
                  (you can adjust if needed). Must be more than 7 days from today.
                </>
              )}
            </p>

            <MaintenanceTechnicianFields
              count={technicianCount}
              names={technicianNames}
              disabled={saving}
              onCountChange={onCountChange}
              onNamesChange={setTechnicianNames}
            />

            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Next maintenance date
            </label>
            <input
              type="date"
              value={nextDate}
              min={(() => {
                const d = new Date();
                d.setDate(d.getDate() + 8);
                return d.toISOString().slice(0, 10);
              })()}
              onChange={(e) => {
                setNextDate(e.target.value);
                setError('');
              }}
              disabled={saving}
              className="w-full input-geometric text-sm font-semibold mb-2"
            />
            {error ? <p className="text-xs font-bold text-red-600 mb-3">{error}</p> : <div className="mb-3" />}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving || !techniciansOk}
                className="px-4 py-2.5 text-sm font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Confirm Done'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
