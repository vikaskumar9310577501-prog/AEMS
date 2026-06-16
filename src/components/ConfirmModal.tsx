import { AnimatePresence, motion } from 'motion/react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmBtnClass?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  confirmBtnClass = 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20',
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 font-sans"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full"
          >
            <h3 className="text-lg font-black text-slate-900 mb-2">{title}</h3>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              {message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-lg ${confirmBtnClass}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
