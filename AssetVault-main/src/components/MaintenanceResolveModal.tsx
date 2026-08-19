import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, X } from 'lucide-react';
import type { MaintenanceComplaint } from '../types/maintenance';

interface MaintenanceResolveModalProps {
  complaint: MaintenanceComplaint | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (remarks: string) => void | Promise<void>;
}

export default function MaintenanceResolveModal({
  complaint,
  saving = false,
  onClose,
  onConfirm,
}: MaintenanceResolveModalProps) {
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (complaint) setRemarks(complaint.remarks || '');
  }, [complaint]);

  return (
    <AnimatePresence>
      {complaint && (
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
            className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="text-emerald-600" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Resolve complaint</h3>
                  <p className="text-xs font-mono font-bold text-blue-700 mt-0.5">{complaint.assetCode}</p>
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

            <p className="text-sm text-slate-600 mb-2 whitespace-pre-wrap line-clamp-4">{complaint.complaintText}</p>
            {complaint.remark ? (
              <p className="text-xs text-slate-500 mb-2">
                <span className="font-bold">Remark:</span> {complaint.remark}
              </p>
            ) : null}
            {complaint.photoUrl ? (
              <a href={complaint.photoUrl} target="_blank" rel="noreferrer" className="mb-3 inline-block">
                <img
                  src={complaint.photoUrl}
                  alt="Complaint"
                  className="h-24 w-36 object-cover rounded-lg border border-slate-200"
                />
              </a>
            ) : null}

            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Resolution remarks (optional)
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              disabled={saving}
              placeholder="What was fixed…"
              className="w-full input-geometric text-sm mb-4 resize-none"
            />

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
                onClick={() => void onConfirm(remarks.trim())}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Mark Done'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
