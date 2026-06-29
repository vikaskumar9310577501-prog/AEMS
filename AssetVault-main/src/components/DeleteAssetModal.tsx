import { AnimatePresence, motion } from 'motion/react';

interface DeleteAssetModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  deleting?: boolean;
}

export default function DeleteAssetModal({ open, onCancel, onConfirm, deleting = false }: DeleteAssetModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full"
          >
            <h3 className="text-lg font-black text-slate-900 mb-2">Delete Asset</h3>
            <p className="text-slate-600 text-sm mb-6">
              Are you sure you want to permanently delete this asset? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={deleting}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={deleting}
                className="px-4 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
