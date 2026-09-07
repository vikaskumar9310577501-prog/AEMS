import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Send,
  Save,
  Clock,
  Settings2,
  FileText,
  History,
  BarChart3,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Sparkles,
  Building2,
  Users,
  Search,
  Check,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type {
  EmailTemplate,
  EmailAutomation,
  EmailDraft,
  EmailExecutionLog,
} from '../types/emailAutomation';
import { parseJsonResponse } from '../lib/apiFetch';
import { plantShortName } from '../lib/plantDisplay';
import { useApp } from '../context/AppProvider';

interface EmailCenterProps {
  locations: string[];
  plants: { code: string; name: string; location: string }[];
  currentPlantCode?: string;
  currentLocation?: string;
}

type SubTab = 'compose' | 'drafts' | 'automations' | 'templates' | 'history';

export default function EmailNotificationCenter({
  locations,
  plants,
  currentPlantCode = '',
  currentLocation = '',
}: EmailCenterProps) {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<SubTab>('automations');
  const [loading, setLoading] = useState(false);

  // Data states
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [automations, setAutomations] = useState<EmailAutomation[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [logs, setLogs] = useState<EmailExecutionLog[]>([]);

  // Compose State
  const [toInput, setToInput] = useState('');
  const [toChips, setToChips] = useState<string[]>([]);
  const [ccChips, setCcChips] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [selectedPlant, setSelectedPlant] = useState(currentPlantCode);
  const [selectedLocation, setSelectedLocation] = useState(currentLocation);

  // Test Email Modal State
  const [testEmailModal, setTestEmailModal] = useState(false);
  const [testTargetEmail, setTestTargetEmail] = useState('');

  // Search & Filter
  const [logSearch, setLogSearch] = useState('');
  const [logFilterStatus, setLogFilterStatus] = useState<string>('all');

  const apiBase = import.meta.env.VITE_API_BASE_URL || '';

  const getHeaders = (extra: Record<string, string> = {}) => {
    const h: Record<string, string> = { ...extra };
    if (user?.email) {
      h['x-user-email'] = user.email;
    }
    return h;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      const [tRes, aRes, dRes, lRes] = await Promise.all([
        fetch(`${apiBase}/api/maintenance/email/templates`, { credentials: 'include', headers }),
        fetch(`${apiBase}/api/maintenance/email/automations`, { credentials: 'include', headers }),
        fetch(`${apiBase}/api/maintenance/email/drafts`, { credentials: 'include', headers }),
        fetch(`${apiBase}/api/maintenance/email/logs`, { credentials: 'include', headers }),
      ]);

      const [tData, aData, dData, lData] = await Promise.all([
        parseJsonResponse<{ templates?: EmailTemplate[] }>(tRes),
        parseJsonResponse<{ automations?: EmailAutomation[] }>(aRes),
        parseJsonResponse<{ drafts?: EmailDraft[] }>(dRes),
        parseJsonResponse<{ logs?: EmailExecutionLog[] }>(lRes),
      ]);

      if (tData.templates) setTemplates(tData.templates);
      if (aData.automations) setAutomations(aData.automations);
      if (dData.drafts) setDrafts(dData.drafts);
      if (lData.logs) setLogs(lData.logs);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddChip = (
    type: 'to' | 'cc',
    val: string,
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    setInput: (v: string) => void
  ) => {
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed.includes('@') && !trimmed.endsWith('@')) {
      setList((prev) => Array.from(new Set([...prev, trimmed])));
      setInput('');
    }
  };

  const handleSendManual = async () => {
    if (toChips.length === 0) return toast.error('Please enter at least one recipient email in TO');
    if (!subject.trim()) return toast.error('Email subject is required');
    if (!bodyHtml.trim()) return toast.error('Email body is required');

    try {
      toast.loading('Sending email...', { id: 'sending-mail' });
      const res = await fetch(`${apiBase}/api/maintenance/email/send`, {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          to: toChips,
          cc: ccChips,
          subject: subject.trim(),
          bodyHtml: bodyHtml.trim(),
          plantCode: selectedPlant,
          location: selectedLocation,
        }),
      });
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Send failed');
      toast.success('Email dispatched successfully!', { id: 'sending-mail' });
      // Reset compose
      setToChips([]);
      setCcChips([]);
      setSubject('');
      setBodyHtml('');
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to send email', { id: 'sending-mail' });
    }
  };

  const handleSaveDraft = async () => {
    if (!subject.trim() && !bodyHtml.trim() && toChips.length === 0) {
      return toast.error('Nothing to save as draft');
    }
    try {
      const res = await fetch(`${apiBase}/api/maintenance/email/drafts`, {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          to: toChips,
          cc: ccChips,
          subject,
          bodyHtml,
          plantCode: selectedPlant,
          location: selectedLocation,
        }),
      });
      if (!res.ok) throw new Error('Save draft failed');
      toast.success('Draft saved successfully');
      fetchData();
    } catch {
      toast.error('Failed to save draft');
    }
  };

  const handleSendTest = async () => {
    if (!testTargetEmail.includes('@')) return toast.error('Valid recipient email required');
    try {
      toast.loading('Sending test email...', { id: 'test-mail' });
      const res = await fetch(`${apiBase}/api/maintenance/email/test`, {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          testEmail: testTargetEmail.trim(),
          subject: subject || undefined,
          bodyHtml: bodyHtml || undefined,
        }),
      });
      const data = await parseJsonResponse<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Test email failed');
      toast.success(data.message || 'Test email sent successfully!', { id: 'test-mail' });
      setTestEmailModal(false);
      setTestTargetEmail('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send test email', { id: 'test-mail' });
    }
  };

  const handleToggleAutomation = async (auto: EmailAutomation) => {
    const nextStatus = auto.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`${apiBase}/api/maintenance/email/automations`, {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...auto,
          status: nextStatus,
        }),
      });
      if (!res.ok) throw new Error('Update failed');
      setAutomations((prev) => prev.map((a) => (a.id === auto.id ? { ...a, status: nextStatus } : a)));
      toast.success(`Automation ${nextStatus === 'active' ? 'activated' : 'paused'}`);
    } catch {
      toast.error('Failed to update automation');
    }
  };

  const handleTriggerNow = async () => {
    try {
      toast.loading('Triggering automated scheduler cycle...', { id: 'trigger-now' });
      const res = await fetch(`${apiBase}/api/maintenance/email/trigger-scheduler`, {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders(),
      });
      const data = await parseJsonResponse<{ sent?: number; skipped?: number }>(res);
      toast.success(`Scheduler executed: ${data.sent || 0} emails sent`, { id: 'trigger-now' });
      fetchData();
    } catch {
      toast.error('Failed to run scheduler cycle', { id: 'trigger-now' });
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (logFilterStatus !== 'all' && l.status !== logFilterStatus) return false;
      if (!logSearch.trim()) return true;
      const q = logSearch.toLowerCase();
      return (
        l.subject.toLowerCase().includes(q) ||
        (l.automationName && l.automationName.toLowerCase().includes(q)) ||
        l.to.some((e) => e.toLowerCase().includes(q)) ||
        (l.plantCode && l.plantCode.toLowerCase().includes(q))
      );
    });
  }, [logs, logSearch, logFilterStatus]);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 text-white shadow-xl border border-blue-900/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
              <Mail size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black tracking-tight">Email & Notification Center</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Auto Scheduler Active (IST)
                </span>
              </div>
              <p className="text-xs text-blue-200/80 font-medium mt-1">
                Centralized automated alerts, consolidated reports, breakdown notifications, and scheduling engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerNow}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/40 transition-all active:scale-95 border border-blue-400/40"
              title="Run scheduler check immediately"
            >
              <Play size={13} className="fill-current" />
              <span>Run Scheduler Now</span>
            </button>
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { id: 'automations', label: 'Automation Master', icon: Settings2, badge: automations.length },
          { id: 'compose', label: 'Send Email', icon: Send },
          { id: 'drafts', label: 'Drafts', icon: FileText, badge: drafts.length },
          { id: 'templates', label: 'Templates', icon: Sparkles, badge: templates.length },
          { id: 'history', label: 'Email History', icon: History, badge: logs.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SubTab)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-blue-300' : 'text-slate-400'} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                    isActive ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-TAB: AUTOMATIONS MASTER */}
      {activeTab === 'automations' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Configured Email Automations</h3>
              <p className="text-xs text-slate-500">
                Automated background notifications triggered by schedules or breakdown events
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTestEmailModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-sm"
            >
              <Send size={12} />
              <span>Send Test Email</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3.5">Automation</th>
                  <th className="px-4 py-3.5">Trigger</th>
                  <th className="px-4 py-3.5">Frequency / Time</th>
                  <th className="px-4 py-3.5">Recipients (TO / CC)</th>
                  <th className="px-4 py-3.5">Consolidated</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {automations.map((a) => {
                  const isActive = a.status === 'active';
                  return (
                    <tr key={a.id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>{a.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] font-bold text-indigo-700">
                        {a.triggerType}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="font-bold capitalize">{a.frequency}</span>
                        {a.scheduleTimes && a.scheduleTimes.length > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                            {a.scheduleTimes.join(', ')}
                          </span>
                        )}
                        {a.reminderDays ? (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold">
                            {a.reminderDays}d before
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {a.recipientRules?.map((r, i) => (
                          <span
                            key={i}
                            className="inline-block mr-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] font-medium"
                          >
                            <span className="font-bold text-slate-800 uppercase">{r.target}:</span> {r.value}
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {a.consolidationMode === 'consolidated' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            Yes (1 Email)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                            Individual
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleAutomation(a)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {isActive ? 'ACTIVE' : 'PAUSED'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleAutomation(a)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          title="Toggle Status"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: COMPOSE / SEND EMAIL */}
      {activeTab === 'compose' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 max-w-4xl mx-auto">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900">Compose Manual Email</h3>
            <p className="text-xs text-slate-500">
              Send an instant professional notification or maintenance update
            </p>
          </div>

          {/* TO Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                To <span className="text-red-500">*</span>
              </label>
              {!showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  + Add CC
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 bg-white">
              {toChips.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg text-xs font-semibold border border-blue-200"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => setToChips((prev) => prev.filter((e) => e !== email))}
                    className="hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="email"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddChip('to', toInput, setToChips, setToInput);
                  }
                }}
                onBlur={() => handleAddChip('to', toInput, setToChips, setToInput)}
                placeholder={toChips.length === 0 ? 'Type email and press Enter...' : ''}
                className="flex-1 min-w-[200px] bg-transparent text-xs outline-none py-1"
              />
            </div>
          </div>

          {/* CC Field */}
          {showCc && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">CC</label>
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 bg-white">
                {ccChips.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => setCcChips((prev) => prev.filter((e) => e !== email))}
                      className="hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="email"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddChip('cc', ccInput, setCcChips, setCcInput);
                    }
                  }}
                  onBlur={() => handleAddChip('cc', ccInput, setCcChips, setCcInput)}
                  placeholder={ccChips.length === 0 ? 'Type CC email and press Enter...' : ''}
                  className="flex-1 min-w-[200px] bg-transparent text-xs outline-none py-1"
                />
              </div>
            </div>
          )}

          {/* Subject Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Urgent Breakdown Update - Press Machine NGM/01"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Scope Filters */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Scope Plant</label>
              <select
                value={selectedPlant}
                onChange={(e) => setSelectedPlant(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
              >
                <option value="">All Plants</option>
                {plants.map((p) => (
                  <option key={p.code} value={p.code}>
                    {plantShortName(p.code, plants)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Scope Location</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Body Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Message Body (HTML / Plain) <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={8}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="Write your email content here... HTML tags like <p>, <strong>, <table> are supported."
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
            />
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                <Save size={13} />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => setTestEmailModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                <Eye size={13} />
                <span>Send Test</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSendManual}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-900/30 transition-all active:scale-95"
            >
              <Send size={13} />
              <span>Send Email Now</span>
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB: DRAFTS */}
      {activeTab === 'drafts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Saved Drafts ({drafts.length})</h3>
          </div>
          {drafts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <FileText size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No saved drafts</p>
              <p className="text-xs text-slate-400 mt-0.5">Drafts created in Send Email will appear here.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {drafts.map((d) => (
                <div key={d.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {d.subject || '(Untitled Draft)'}
                    </h4>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`${apiBase}/api/maintenance/email/drafts/${d.id}`, {
                          method: 'DELETE',
                          credentials: 'include',
                        });
                        setDrafts((prev) => prev.filter((row) => row.id !== d.id));
                        toast.success('Draft deleted');
                      }}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{d.bodyHtml.replace(/<[^>]+>/g, ' ')}</p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>To: {d.to?.join(', ') || 'No recipients'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setToChips(d.to || []);
                        setCcChips(d.cc || []);
                        setSubject(d.subject || '');
                        setBodyHtml(d.bodyHtml || '');
                        setActiveTab('compose');
                      }}
                      className="text-blue-600 font-bold hover:underline"
                    >
                      Open in Compose →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Email Templates ({templates.length})</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{t.name}</h4>
                    <span className="text-[10px] font-mono text-indigo-700 font-semibold">{t.category}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    Active
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-800 bg-slate-50 p-2 rounded-lg truncate">
                  <span className="text-slate-400 font-normal">Subject:</span> {t.subject}
                </p>
                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                  {t.variables?.map((v, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB: HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search by subject, email, or plant..."
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {['all', 'sent', 'failed'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setLogFilterStatus(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                    logFilterStatus === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="px-3.5 py-3">Time / Date</th>
                  <th className="px-3.5 py-3">Subject</th>
                  <th className="px-3.5 py-3">Trigger</th>
                  <th className="px-3.5 py-3">Recipients</th>
                  <th className="px-3.5 py-3">Plant</th>
                  <th className="px-3.5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">
                      No email execution history found
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-500">
                        {l.date} {l.time}
                      </td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 max-w-xs truncate" title={l.subject}>
                        {l.subject}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-indigo-700">{l.triggerType}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 max-w-xs truncate" title={l.to?.join(', ')}>
                        {l.to?.join(', ')}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800">
                        {l.plantCode ? plantShortName(l.plantCode) : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        {l.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            <CheckCircle2 size={11} /> Sent
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold border border-red-200"
                            title={l.failureReason}
                          >
                            <XCircle size={11} /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {testEmailModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Send Test Email</h3>
              <p className="text-xs text-slate-500">
                Safely verify SMTP delivery and formatting without emailing production recipients.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-700">Recipient Email</label>
              <input
                type="email"
                required
                value={testTargetEmail}
                onChange={(e) => setTestTargetEmail(e.target.value)}
                placeholder="e.g. your.email@pgel.in"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTestEmailModal(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTest}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-md"
              >
                Dispatch Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
