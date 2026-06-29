import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Database, Layers, Sparkles, Trash2 } from 'lucide-react';
import { parseJsonResponse } from '../lib/apiFetch';
import { DATABASE_LABEL } from '../lib/uiLabels';

export default function DatabaseSetupPanel() {
  const [busy, setBusy] = useState<'legacy' | 'redesigned' | 'fresh' | null>(null);

  const runLegacy = async () => {
    setBusy('legacy');
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/setup', { method: 'POST' });
      const data = await parseJsonResponse<{ error?: string; success?: boolean }>(res);
      if (!res.ok || data.error) throw new Error(data.error || 'Setup failed');
      toast.success(`${DATABASE_LABEL} category sheets ready (legacy mode)`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setBusy(null);
    }
  };

  const runRedesigned = async () => {
    setBusy('redesigned');
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/setup/redesigned', { method: 'POST' });
      const data = await parseJsonResponse<{ error?: string; success?: boolean }>(res);
      if (!res.ok || data.error) throw new Error(data.error || 'Setup failed');
      toast.success(`${DATABASE_LABEL} redesigned tables ready — single Assets master table`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setBusy(null);
    }
  };

  const runFreshReset = async () => {
    const ok = window.confirm(
      `This will DELETE all assets, users, employees, and legacy category sheet data.\n\n` +
        `A fresh database will be created with:\n` +
        `• One Assets table (location / plant / category as columns — no duplicate rows on dashboard)\n` +
        `• Default admin: admin@example.com\n\n` +
        `Continue?`
    );
    if (!ok) return;

    setBusy('fresh');
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/setup/redesigned-fresh', { method: 'POST' });
      const data = await parseJsonResponse<{ error?: string; success?: boolean; message?: string }>(res);
      if (!res.ok || data.error) throw new Error(data.error || 'Reset failed');
      toast.success(data.message || 'Database reset complete');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Use <strong>Fresh database reset</strong> for the recommended setup: one master Assets table, filters by
        location / plant / category on the dashboard (no duplicate rows), and unique serial / asset code / vehicle
        numbers enforced.
      </p>

      <div className="p-5 border-2 border-amber-300 rounded-2xl bg-amber-50/80 space-y-3">
        <div className="flex items-center gap-2 text-amber-900 font-black">
          <Trash2 size={18} className="text-amber-700" />
          Fresh database reset (recommended)
        </div>
        <p className="text-xs text-amber-900/80">
          Clears all old data, creates redesigned sheets with expanded columns (Location, Plant Code, Plant Name,
          Category, Vehicle Number, etc.), seeds categories & locations, and restores default admin user.
        </p>
        <button
          type="button"
          disabled={!!busy}
          onClick={runFreshReset}
          className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy === 'fresh' ? 'Resetting…' : 'Reset database & start fresh'}
        </button>
        <p className="text-[10px] text-amber-800 flex items-center gap-1">
          <AlertTriangle size={12} /> Deploy the latest backend script before running reset.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-5 border border-slate-200 rounded-2xl bg-slate-50 space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-black">
            <Layers size={18} className="text-blue-600" />
            Setup category sheets
          </div>
          <p className="text-xs text-slate-600">
            Legacy mode: separate tabs per category. Can show duplicates on dashboard if the same asset exists in
            multiple sheets.
          </p>
          <button
            type="button"
            disabled={!!busy}
            onClick={runLegacy}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {busy === 'legacy' ? 'Setting up…' : 'Run category setup'}
          </button>
        </div>
        <div className="p-5 border border-emerald-200 rounded-2xl bg-emerald-50/50 space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-black">
            <Sparkles size={18} className="text-emerald-600" />
            New production setup (keep data)
          </div>
          <p className="text-xs text-slate-600">
            Adds or updates redesigned table headers without deleting existing rows.
          </p>
          <button
            type="button"
            disabled={!!busy}
            onClick={runRedesigned}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {busy === 'redesigned' ? 'Setting up…' : 'Run new database setup'}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 flex items-center gap-1">
        <Database size={12} /> Deploy the latest backend script before running setup.
      </p>
    </div>
  );
}
