import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { APP_NAME, LOGO_SRC } from '../lib/constants';
import { parseJsonResponse } from '../lib/apiFetch';
import type { MaintenanceMachine } from '../types/maintenance';
import { plantShortName, type PlantLike } from '../lib/plantDisplay';
import { Camera, CheckCircle2, ImagePlus, Wrench, X } from 'lucide-react';

/** Public QR landing — locked machine identity + downtime complaint form. */
export default function MaintenanceReportPage() {
  const { assetCode = '' } = useParams<{ assetCode: string }>();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [machine, setMachine] = useState<MaintenanceMachine | null>(null);
  const [plants, setPlants] = useState<PlantLike[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [complaintText, setComplaintText] = useState('');
  const [remark, setRemark] = useState('');
  const [downtimeHours] = useState('');
  const [downtimeMinutes] = useState('');
  const [photoData, setPhotoData] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError('');
      setSubmitted(false);
      setComplaintText('');
      setRemark('');
      setPhotoData('');
      setPhotoName('');
      try {
        const base = import.meta.env.VITE_API_BASE_URL || '';
        const [machRes, settingsRes] = await Promise.all([
          fetch(`${base}/api/maintenance/scan/${encodeURIComponent(assetCode)}`),
          fetch(`${base}/api/settings`),
        ]);
        const data = await parseJsonResponse<{ machine?: MaintenanceMachine; error?: string }>(machRes);
        const settingsData = await parseJsonResponse<{ plants?: PlantLike[] }>(settingsRes);
        if (!active) return;
        if (!machRes.ok || !data.machine) throw new Error(data.error || 'Machine not found');
        setPlants(settingsData.plants || []);
        setMachine(data.machine);
      } catch (e: unknown) {
        if (!active) return;
        setMachine(null);
        setError(e instanceof Error ? e.message : 'Machine not found');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [assetCode]);

  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      const compressed = await compressComplaintPhoto(file);
      setPhotoData(compressed.dataUrl);
      setPhotoName(compressed.name);
    } catch (e: unknown) {
      setPhotoData('');
      setPhotoName('');
      setError(e instanceof Error ? e.message : 'Could not read photo');
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine || submitting) return;
    const text = complaintText.trim();
    const remarkText = remark.trim();
    const hours = Math.max(0, Math.floor(Number(downtimeHours) || 0));
    const mins = Math.max(0, Math.min(59, Math.floor(Number(downtimeMinutes) || 0)));
    if (text.length < 5) {
      setError('Please describe the issue (at least 5 characters).');
      return;
    }
    if (remarkText.length < 3) {
      setError('Remark is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/maintenance/complaints/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetCode: machine.assetCode,
          complaintText: text,
          remark: remarkText,
          downtimeHours: hours,
          downtimeMinutes: mins,
          photoData: photoData || undefined,
          photoName: photoName || undefined,
        }),
      });
      const data = await parseJsonResponse<{
        success?: boolean;
        mailSent?: boolean;
        mailError?: string;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to submit complaint');
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-5">
        <div className="flex items-center gap-3">
          <img src={LOGO_SRC} alt={APP_NAME} className="h-8 object-contain" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Maintenance</p>
            <h1 className="text-lg font-black text-slate-900">Machine complaint</h1>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 text-center py-8">Loading machine…</p>
        ) : !machine ? (
          <p className="text-sm font-bold text-red-600 text-center py-8">{error || 'Machine not found'}</p>
        ) : submitted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center space-y-3">
            <CheckCircle2 className="mx-auto text-emerald-600" size={36} />
            <p className="text-base font-black text-emerald-900">Complaint submitted</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-800 font-black text-sm">
                <Wrench size={16} className="text-blue-600" />
                Machine identity (locked)
              </div>
              <Field label="Asset Code" value={machine.assetCode} mono />
              <Field label="Machine Type" value={machine.machineType} />
              <Field label="Machine Number" value={machine.machineNumber} mono />
              {machine.equipmentName ? <Field label="Machine" value={machine.equipmentName} /> : null}
              {machine.department ? <Field label="Department" value={machine.department} /> : null}
              {machine.responsibility ? <Field label="Responsibility" value={machine.responsibility} /> : null}
              <Field label="Location" value={machine.location} />
              <Field label="Plant" value={plantShortName(machine.plantCode, plants)} />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Complaint / issue details
              </label>
              <textarea
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                rows={4}
                required
                placeholder="Describe the downtime or issue clearly…"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>


            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Remark <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={3}
                required
                placeholder="Add a remark…"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Photo
              </label>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void onPickPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void onPickPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              {photoData ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200">
                  <img src={photoData} alt="Complaint" className="w-full h-40 object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoData('');
                      setPhotoName('');
                    }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 text-slate-700 flex items-center justify-center shadow"
                    aria-label="Remove photo"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    <Camera size={16} className="text-blue-600" />
                    Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    <ImagePlus size={16} className="text-blue-600" />
                    Gallery
                  </button>
                </div>
              )}
            </div>

            {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit complaint'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-sm font-bold text-slate-900 ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function compressComplaintPhoto(file: File): Promise<{ dataUrl: string; name: string }> {
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
        name: `${file.name.replace(/\.[^.]+$/, '') || 'complaint-photo'}.jpg`,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read photo'));
    };
    img.src = url;
  });
}
