import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, CheckCircle2, ImagePlus, X } from 'lucide-react';
import type { MaintenanceComplaint } from '../types/maintenance';
import type { MaintenanceTechnicianPayload } from '../lib/maintenanceTechnicians';
import { buildTechnicianNameSlots, validateTechnicians } from '../lib/maintenanceTechnicians';
import MaintenanceTechnicianFields from './MaintenanceTechnicianFields';

export const MIN_RESOLUTION_WORDS = 50;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type ResolveComplaintPayload = {
  remarks: string;
  photoData: string;
  photoName: string;
} & MaintenanceTechnicianPayload;

interface MaintenanceResolveModalProps {
  complaint: MaintenanceComplaint | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (payload: ResolveComplaintPayload) => void | Promise<void>;
}

export default function MaintenanceResolveModal({
  complaint,
  saving = false,
  onClose,
  onConfirm,
}: MaintenanceResolveModalProps) {
  const [remarks, setRemarks] = useState('');
  const [photoData, setPhotoData] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [technicianCount, setTechnicianCount] = useState(1);
  const [technicianNames, setTechnicianNames] = useState<string[]>(['']);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!complaint) return;
    setRemarks(complaint.remarks || '');
    setPhotoData('');
    setPhotoName('');
    setPhotoError('');
    setTechnicianCount(1);
    setTechnicianNames(['']);
    if (fileRef.current) fileRef.current.value = '';
  }, [complaint]);

  const words = useMemo(() => countWords(remarks), [remarks]);
  const remarksOk = words >= MIN_RESOLUTION_WORDS;
  const photoOk = Boolean(photoData);
  const techniciansOk = !validateTechnicians(technicianCount, technicianNames);
  const canSubmit = remarksOk && photoOk && techniciansOk && !saving;

  const onCountChange = (count: number) => {
    setTechnicianCount(count);
    setTechnicianNames(buildTechnicianNameSlots(count, technicianNames));
  };

  const onPickPhoto = async (file?: File) => {
    setPhotoError('');
    if (!file) return;
    try {
      const compressed = await compressEvidencePhoto(file);
      setPhotoData(compressed.dataUrl);
      setPhotoName(compressed.name);
    } catch (e) {
      setPhotoData('');
      setPhotoName('');
      setPhotoError(e instanceof Error ? e.message : 'Could not read photo');
    }
  };

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
            className="bg-[#FFFCF8] rounded-2xl shadow-2xl p-6 sm:p-7 max-w-lg w-full border border-stone-200/80 max-h-[min(92vh,820px)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="text-emerald-600" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-900">Mark Done</h3>
                  <p className="text-xs font-mono font-bold text-blue-700 mt-0.5">{complaint.assetCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-stone-600 mb-4 whitespace-pre-wrap line-clamp-3">{complaint.complaintText}</p>

            <MaintenanceTechnicianFields
              count={technicianCount}
              names={technicianNames}
              disabled={saving}
              onCountChange={onCountChange}
              onNamesChange={setTechnicianNames}
            />

            <label className="block text-[10px] font-black uppercase tracking-wider text-stone-500 mb-1.5">
              Evidence photo <span className="text-rose-600">required</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              capture="environment"
              className="hidden"
              disabled={saving}
              onChange={(e) => void onPickPhoto(e.target.files?.[0])}
            />
            {photoData ? (
              <div className="mb-4 rounded-xl border border-stone-200 bg-white p-2">
                <img src={photoData} alt="Resolution evidence" className="h-36 w-full object-cover rounded-lg" />
                <div className="flex items-center justify-between gap-2 mt-2 px-1">
                  <p className="text-[11px] font-semibold text-stone-600 truncate">{photoName}</p>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setPhotoData('');
                      setPhotoName('');
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    className="text-[10px] font-black uppercase text-rose-600 hover:text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => fileRef.current?.click()}
                className="mb-4 w-full rounded-xl border-2 border-dashed border-stone-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40 px-4 py-6 text-center transition-colors disabled:opacity-50"
              >
                <ImagePlus className="mx-auto text-stone-400 mb-2" size={22} />
                <p className="text-sm font-bold text-stone-800">Upload close-out evidence</p>
                <p className="text-[11px] text-stone-500 mt-0.5 inline-flex items-center gap-1">
                  <Camera size={12} /> JPEG / PNG · shop-floor photo after fix
                </p>
              </button>
            )}
            {photoError ? <p className="text-xs font-semibold text-rose-600 -mt-3 mb-3">{photoError}</p> : null}

            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                Resolution remark <span className="text-rose-600">min {MIN_RESOLUTION_WORDS} words</span>
              </label>
              <span
                className={`text-[10px] font-black tabular-nums ${
                  remarksOk ? 'text-emerald-700' : 'text-stone-500'
                }`}
              >
                {words} / {MIN_RESOLUTION_WORDS}
              </span>
            </div>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={5}
              disabled={saving}
              placeholder="Describe the fault found, action taken, spare used, and confirmation that the machine is running…"
              className="w-full input-geometric text-sm mb-2 resize-y min-h-[120px]"
            />
            {!remarksOk ? (
              <p className="text-[11px] text-stone-500 mb-4">
                Add a proper close-out note ({MIN_RESOLUTION_WORDS - words} more word
                {MIN_RESOLUTION_WORDS - words === 1 ? '' : 's'}).
              </p>
            ) : (
              <p className="text-[11px] text-emerald-700 mb-4">Remark length met.</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-bold text-stone-600 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  void onConfirm({
                    remarks: remarks.trim(),
                    photoData,
                    photoName,
                    technicianCount,
                    technicianNames: technicianNames.map((n) => n.trim()),
                  })
                }
                disabled={!canSubmit}
                className="px-4 py-2.5 text-sm font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
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

function compressEvidencePhoto(file: File): Promise<{ dataUrl: string; name: string }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose a photo (JPEG or PNG).'));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1280;
      let { width, height } = img;
      if (width > max || height > max) {
        const scale = max / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not process photo'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve({
        dataUrl: canvas.toDataURL('image/jpeg', 0.82),
        name: `${file.name.replace(/\.[^.]+$/, '') || 'resolution-evidence'}.jpg`,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read photo'));
    };
    img.src = url;
  });
}
