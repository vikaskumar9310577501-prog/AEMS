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
  Edit3,
  X,
  Info,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type {
  EmailTemplate,
  EmailAutomation,
  EmailDraft,
  EmailExecutionLog,
  RecipientRule,
  EmailFrequency,
} from '../types/emailAutomation';
import type { MaintenanceMeta, MaintenancePlantContact } from '../types/maintenance';
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

  // Plant Contacts State (HOD / FH / PH emails)
  const [plantContacts, setPlantContacts] = useState<Record<string, MaintenancePlantContact>>({});
  const [contactDraft, setContactDraft] = useState<Record<string, MaintenancePlantContact>>({});
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [savingContacts, setSavingContacts] = useState(false);

  // Edit Automation State
  const [editingAuto, setEditingAuto] = useState<EmailAutomation | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'paused'>('active');
  const [editFrequency, setEditFrequency] = useState<EmailFrequency>('daily');
  const [editScheduleTimes, setEditScheduleTimes] = useState<string[]>([]);
  const [newTimeInput, setNewTimeInput] = useState('');
  const [editToRoles, setEditToRoles] = useState<string[]>(['HOD', 'FH', 'PH']);
  const [editToEmails, setEditToEmails] = useState<string[]>([]);
  const [editToEmailInput, setEditToEmailInput] = useState('');
  const [editCcRoles, setEditCcRoles] = useState<string[]>([]);
  const [editCcEmails, setEditCcEmails] = useState<string[]>([]);
  const [editCcEmailInput, setEditCcEmailInput] = useState('');
  const [editPreviewPlant, setEditPreviewPlant] = useState('');
  const [savingAuto, setSavingAuto] = useState(false);

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
      const [tRes, aRes, dRes, lRes, mRes] = await Promise.all([
        fetch(`${apiBase}/api/maintenance/email/templates`, { credentials: 'include', headers }),
        fetch(`${apiBase}/api/maintenance/email/automations`, { credentials: 'include', headers }),
        fetch(`${apiBase}/api/maintenance/email/drafts`, { credentials: 'include', headers }),
        fetch(`${apiBase}/api/maintenance/email/logs`, { credentials: 'include', headers }),
        fetch(`${apiBase}/api/maintenance/meta`, { credentials: 'include', headers }),
      ]);

      const [tData, aData, dData, lData, mData] = await Promise.all([
        parseJsonResponse<{ templates?: EmailTemplate[] }>(tRes),
        parseJsonResponse<{ automations?: EmailAutomation[] }>(aRes),
        parseJsonResponse<{ drafts?: EmailDraft[] }>(dRes),
        parseJsonResponse<{ logs?: EmailExecutionLog[] }>(lRes),
        parseJsonResponse<{ meta?: MaintenanceMeta }>(mRes),
      ]);

      if (tData.templates) setTemplates(tData.templates);
      if (aData.automations) setAutomations(aData.automations);
      if (dData.drafts) setDrafts(dData.drafts);
      if (lData.logs) setLogs(lData.logs);
      if (mData.meta?.plantContacts) {
        setPlantContacts(mData.meta.plantContacts);
        setContactDraft(mData.meta.plantContacts);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Deduplicate and filter plants based on selectedLocation
  const filteredPlants = useMemo(() => {
    const uniqueMap = new Map<string, { code: string; name: string; location: string }>();
    for (const p of plants) {
      if (!p.code) continue;
      if (!uniqueMap.has(p.code)) {
        uniqueMap.set(p.code, p);
      }
    }
    const list = Array.from(uniqueMap.values());
    if (!selectedLocation) return list;
    const normLoc = selectedLocation.trim().toLowerCase();
    return list.filter((p) => (p.location || '').trim().toLowerCase() === normLoc);
  }, [plants, selectedLocation]);

  const handleLocationChange = (newLoc: string) => {
    setSelectedLocation(newLoc);
    if (!newLoc) return;
    const normLoc = newLoc.trim().toLowerCase();
    const plantMatch = plants.find((p) => p.code === selectedPlant);
    if (plantMatch && (plantMatch.location || '').trim().toLowerCase() !== normLoc) {
      setSelectedPlant('');
    }
  };

  const handleOpenEditAuto = (auto: EmailAutomation) => {
    setEditingAuto(auto);
    setEditName(auto.name);
    setEditStatus(auto.status);
    setEditFrequency(auto.frequency);
    setEditScheduleTimes(auto.scheduleTimes || ['09:00']);
    setNewTimeInput('');

    const toRolesSet = new Set<string>();
    const toEmailsList: string[] = [];
    const ccRolesSet = new Set<string>();
    const ccEmailsList: string[] = [];

    for (const rule of auto.recipientRules || []) {
      const target = rule.target || 'to';
      if (rule.type === 'plant_contacts') {
        const roles = (rule.value || '').toUpperCase().split(',').map((r) => r.trim()).filter(Boolean);
        for (const r of roles) {
          if (target === 'cc') ccRolesSet.add(r);
          else toRolesSet.add(r);
        }
      } else {
        const emails = (rule.value || '').split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'));
        for (const e of emails) {
          if (target === 'cc') ccEmailsList.push(e);
          else toEmailsList.push(e);
        }
      }
    }

    setEditToRoles(Array.from(toRolesSet));
    setEditToEmails(Array.from(new Set(toEmailsList)));
    setEditToEmailInput('');
    setEditCcRoles(Array.from(ccRolesSet));
    setEditCcEmails(Array.from(new Set(ccEmailsList)));
    setEditCcEmailInput('');
    setEditPreviewPlant(currentPlantCode || (plants[0]?.code ?? ''));
  };

  const handleSaveEditedAuto = async () => {
    if (!editingAuto) return;
    if (!editName.trim()) return toast.error('Automation name is required');

    setSavingAuto(true);
    try {
      const recipientRules: RecipientRule[] = [];
      if (editToRoles.length > 0) {
        recipientRules.push({
          type: 'plant_contacts',
          value: editToRoles.join(','),
          target: 'to',
        });
      }
      if (editToEmails.length > 0) {
        recipientRules.push({
          type: 'manual_email',
          value: editToEmails.join(', '),
          target: 'to',
        });
      }
      if (editCcRoles.length > 0) {
        recipientRules.push({
          type: 'plant_contacts',
          value: editCcRoles.join(','),
          target: 'cc',
        });
      }
      if (editCcEmails.length > 0) {
        recipientRules.push({
          type: 'manual_email',
          value: editCcEmails.join(', '),
          target: 'cc',
        });
      }

      const updated: EmailAutomation = {
        ...editingAuto,
        name: editName.trim(),
        status: editStatus,
        frequency: editFrequency,
        scheduleTimes: editScheduleTimes,
        recipientRules,
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch(`${apiBase}/api/maintenance/email/automations`, {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updated),
      });
      const data = await parseJsonResponse<{ error?: string; automation?: EmailAutomation }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to update automation');

      setAutomations((prev) => prev.map((a) => (a.id === editingAuto.id ? (data.automation || updated) : a)));
      toast.success('Automation recipients and schedule saved successfully!');
      setEditingAuto(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save automation');
    } finally {
      setSavingAuto(false);
    }
  };

  const handleSavePlantContacts = async () => {
    setSavingContacts(true);
    try {
      const res = await fetch(`${apiBase}/api/maintenance/meta`, {
        method: 'PUT',
        credentials: 'include',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ plantContacts: contactDraft }),
      });
      const data = await parseJsonResponse<{ error?: string; meta?: MaintenanceMeta }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to save plant contacts');
      setPlantContacts(contactDraft);
      toast.success('Plant contact emails saved successfully!');
      setContactModalOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save plant contacts');
    } finally {
      setSavingContacts(false);
    }
  };

  const previewRecipients = useMemo(() => {
    if (!editingAuto || !editPreviewPlant) return { to: [], cc: [] };
    const toSet = new Set<string>();
    const ccSet = new Set<string>();

    const contact =
      plantContacts[editPreviewPlant] ||
      plantContacts[editPreviewPlant.toUpperCase()] ||
      plantContacts[editPreviewPlant.toLowerCase()];

    if (contact) {
      if (editToRoles.includes('HOD') && contact.hodEmail) toSet.add(contact.hodEmail);
      if (editToRoles.includes('FH') && contact.fhEmail) toSet.add(contact.fhEmail);
      if (editToRoles.includes('PH') && contact.phEmail) toSet.add(contact.phEmail);

      if (editCcRoles.includes('HOD') && contact.hodEmail) ccSet.add(contact.hodEmail);
      if (editCcRoles.includes('FH') && contact.fhEmail) ccSet.add(contact.fhEmail);
      if (editCcRoles.includes('PH') && contact.phEmail) ccSet.add(contact.phEmail);
    }

    for (const e of editToEmails) toSet.add(e);
    for (const e of editCcEmails) ccSet.add(e);

    return {
      to: Array.from(toSet),
      cc: Array.from(ccSet),
    };
  }, [editingAuto, editPreviewPlant, editToRoles, editToEmails, editCcRoles, editCcEmails, plantContacts]);

  const allUniquePlants = useMemo(() => {
    const map = new Map<string, { code: string; name: string; location: string }>();
    for (const p of plants) {
      if (!p.code) continue;
      if (!map.has(p.code)) map.set(p.code, p);
    }
    return Array.from(map.values()).sort((a, b) => (a.name || a.code).localeCompare(b.name || b.code));
  }, [plants]);

  const filteredContactPlants = useMemo(() => {
    if (!contactSearch.trim()) return allUniquePlants;
    const q = contactSearch.toLowerCase();
    return allUniquePlants.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q))
    );
  }, [allUniquePlants, contactSearch]);

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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setContactModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-lg shadow-sm transition-colors"
                title="View and configure HOD, FH, PH email addresses"
              >
                <Users size={13} />
                <span>Plant Contact Emails (HOD / FH / PH)</span>
              </button>
              <button
                type="button"
                onClick={() => setTestEmailModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-sm"
              >
                <Send size={12} />
                <span>Send Test Email</span>
              </button>
            </div>
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
                        <div className="flex flex-col gap-1.5">
                          {a.recipientRules?.map((r, i) => {
                            const isTo = r.target === 'to';
                            return (
                              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                    isTo ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-slate-200 text-slate-800 border border-slate-300'
                                  }`}
                                >
                                  {r.target}:
                                </span>
                                <span className="font-semibold text-slate-800" title={r.value}>
                                  {r.value}
                                </span>
                                {r.type === 'plant_contacts' && (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    (Plant Contacts)
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => handleOpenEditAuto(a)}
                            className="text-[10px] text-blue-600 font-bold hover:underline self-start inline-flex items-center gap-1 mt-0.5"
                          >
                            <Edit3 size={10} />
                            <span>Edit Recipients / Schedule</span>
                          </button>
                        </div>
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
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditAuto(a)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors border border-blue-200/70"
                            title="Edit Recipients & Schedule"
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleAutomation(a)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            title="Toggle Status"
                          >
                            <RefreshCw size={14} />
                          </button>
                        </div>
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

          {/* Scope Filters: Location first, then Plant (filtered by location) */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Scope Location</label>
              <select
                value={selectedLocation}
                onChange={(e) => handleLocationChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Scope Plant</label>
              <select
                value={selectedPlant}
                onChange={(e) => setSelectedPlant(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">{selectedLocation ? `All Plants in ${selectedLocation}` : 'All Plants'}</option>
                {filteredPlants.map((p) => (
                  <option key={p.code} value={p.code}>
                    {plantShortName(p.code, plants)}
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

      {/* Plant Contacts Directory Modal */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Plant Contact Emails (HOD / FH / PH Directory)</h3>
                  <p className="text-xs text-slate-500">
                    Automations configured with rules 'HOD, FH, PH' automatically send alerts to these addresses.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search & Info */}
            <div className="px-6 py-3 border-b border-slate-100 bg-blue-50/50 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search plant name, code, or location..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <span className="text-[11px] text-slate-500 font-semibold">
                Showing {filteredContactPlants.length} Plants
              </span>
            </div>

            {/* Plants Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {filteredContactPlants.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">No plants match your search.</div>
              ) : (
                filteredContactPlants.map((p) => {
                  const current = contactDraft[p.code] || {};
                  return (
                    <div
                      key={p.code}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-black font-mono">
                            {p.code}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{plantShortName(p.code, plants)}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">{p.location || 'No location'}</span>
                      </div>

                      <div className="grid sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-slate-600">Plant HOD Email</label>
                          <input
                            type="email"
                            value={current.hodEmail || ''}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              setContactDraft((prev) => ({
                                ...prev,
                                [p.code]: { ...prev[p.code], hodEmail: val },
                              }));
                            }}
                            placeholder="hod@pgel.in"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-slate-600">Factory Head (FH)</label>
                          <input
                            type="email"
                            value={current.fhEmail || ''}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              setContactDraft((prev) => ({
                                ...prev,
                                [p.code]: { ...prev[p.code], fhEmail: val },
                              }));
                            }}
                            placeholder="fh@pgel.in"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-slate-600">Plant Head (PH)</label>
                          <input
                            type="email"
                            value={current.phEmail || ''}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              setContactDraft((prev) => ({
                                ...prev,
                                [p.code]: { ...prev[p.code], phEmail: val },
                              }));
                            }}
                            placeholder="ph@pgel.in"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Changes take effect across all automated scheduled emails immediately after saving.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setContactModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingContacts}
                  onClick={handleSavePlantContacts}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>{savingContacts ? 'Saving...' : 'Save All Plant Contacts'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Automation Modal */}
      {editingAuto && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Configure Automation & Recipients</h3>
                  <p className="text-xs text-slate-500">
                    Set schedule times, TO/CC recipient rules, and test resolved recipient delivery.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAuto(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Automation Name & Status */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-700">Automation Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-slate-700">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-slate-700">Frequency</label>
                    <select
                      value={editFrequency}
                      onChange={(e) => setEditFrequency(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="daily">Daily</option>
                      <option value="instant">Instant</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Schedule Times (IST) */}
              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="text-xs font-bold uppercase text-slate-700 flex items-center justify-between">
                  <span>Schedule Times (IST 24h format)</span>
                  <span className="text-[11px] text-slate-400 font-normal">e.g. 09:00, 18:00</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {editScheduleTimes.map((time, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 text-slate-800 rounded-lg text-xs font-mono font-bold shadow-sm"
                    >
                      <Clock size={11} className="text-blue-500" />
                      <span>{time}</span>
                      <button
                        type="button"
                        onClick={() => setEditScheduleTimes((prev) => prev.filter((_, i) => i !== idx))}
                        className="hover:text-red-500 ml-1 text-slate-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="time"
                      value={newTimeInput}
                      onChange={(e) => setNewTimeInput(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newTimeInput && !editScheduleTimes.includes(newTimeInput)) {
                          setEditScheduleTimes((prev) => [...prev, newTimeInput].sort());
                          setNewTimeInput('');
                        }
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
                    >
                      + Add Time
                    </button>
                  </div>
                </div>
              </div>

              {/* TO Recipients Section */}
              <div className="space-y-2 border border-blue-200/80 rounded-xl p-4 bg-blue-50/20">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-blue-900">
                    TO Recipients <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-blue-600">Main Action Takers</span>
                </div>

                {/* Role Checkboxes for TO */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <span className="text-[11px] font-bold text-slate-600">Plant Roles:</span>
                  {(['HOD', 'FH', 'PH'] as const).map((role) => {
                    const isChecked = editToRoles.includes(role);
                    return (
                      <label
                        key={role}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isChecked}
                          onChange={() => {
                            setEditToRoles((prev) =>
                              isChecked ? prev.filter((r) => r !== role) : [...prev, role]
                            );
                          }}
                        />
                        <span>{role === 'HOD' ? 'Plant HOD' : role === 'FH' ? 'Factory Head (FH)' : 'Plant Head (PH)'}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Custom Emails for TO */}
                <div className="space-y-1 pt-2">
                  <label className="text-[11px] font-bold text-slate-600">Additional TO Email Addresses:</label>
                  <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500">
                    {editToEmails.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-800 rounded-md text-xs font-medium border border-blue-200"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => setEditToEmails((prev) => prev.filter((e) => e !== email))}
                          className="hover:text-red-500 ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="email"
                      value={editToEmailInput}
                      onChange={(e) => setEditToEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          const val = editToEmailInput.trim().toLowerCase();
                          if (val.includes('@') && !val.endsWith('@')) {
                            setEditToEmails((prev) => Array.from(new Set([...prev, val])));
                            setEditToEmailInput('');
                          }
                        }
                      }}
                      onBlur={() => {
                        const val = editToEmailInput.trim().toLowerCase();
                        if (val.includes('@') && !val.endsWith('@')) {
                          setEditToEmails((prev) => Array.from(new Set([...prev, val])));
                          setEditToEmailInput('');
                        }
                      }}
                      placeholder="Type custom email and press Enter..."
                      className="flex-1 min-w-[200px] text-xs outline-none py-1"
                    />
                  </div>
                </div>
              </div>

              {/* CC Recipients Section */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                    CC Recipients
                  </label>
                  <span className="text-[10px] font-bold text-slate-500">Informational / Escalation</span>
                </div>

                {/* Role Checkboxes for CC */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <span className="text-[11px] font-bold text-slate-600">Plant Roles:</span>
                  {(['HOD', 'FH', 'PH'] as const).map((role) => {
                    const isChecked = editCcRoles.includes(role);
                    return (
                      <label
                        key={role}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isChecked}
                          onChange={() => {
                            setEditCcRoles((prev) =>
                              isChecked ? prev.filter((r) => r !== role) : [...prev, role]
                            );
                          }}
                        />
                        <span>{role === 'HOD' ? 'Plant HOD' : role === 'FH' ? 'Factory Head (FH)' : 'Plant Head (PH)'}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Custom Emails for CC */}
                <div className="space-y-1 pt-2">
                  <label className="text-[11px] font-bold text-slate-600">Additional CC Email Addresses:</label>
                  <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500">
                    {editCcEmails.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-800 rounded-md text-xs font-medium border border-slate-200"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => setEditCcEmails((prev) => prev.filter((e) => e !== email))}
                          className="hover:text-red-500 ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="email"
                      value={editCcEmailInput}
                      onChange={(e) => setEditCcEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          const val = editCcEmailInput.trim().toLowerCase();
                          if (val.includes('@') && !val.endsWith('@')) {
                            setEditCcEmails((prev) => Array.from(new Set([...prev, val])));
                            setEditCcEmailInput('');
                          }
                        }
                      }}
                      onBlur={() => {
                        const val = editCcEmailInput.trim().toLowerCase();
                        if (val.includes('@') && !val.endsWith('@')) {
                          setEditCcEmails((prev) => Array.from(new Set([...prev, val])));
                          setEditCcEmailInput('');
                        }
                      }}
                      placeholder="Type custom CC email and press Enter..."
                      className="flex-1 min-w-[200px] text-xs outline-none py-1"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview of Resolved Recipients */}
              <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-300">Live Recipient Resolution Test</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">For Plant:</span>
                    <select
                      value={editPreviewPlant}
                      onChange={(e) => setEditPreviewPlant(e.target.value)}
                      className="px-2.5 py-1 bg-slate-800 text-white border border-slate-700 rounded-lg text-xs font-medium outline-none"
                    >
                      {allUniquePlants.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1 text-xs pt-1">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold w-8 shrink-0">TO:</span>
                    <div className="flex flex-wrap gap-1">
                      {previewRecipients.to.length === 0 ? (
                        <span className="text-slate-500 italic text-[11px]">No TO recipients resolved for this plant</span>
                      ) : (
                        previewRecipients.to.map((e, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[11px] font-mono">
                            {e}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 font-bold w-8 shrink-0">CC:</span>
                    <div className="flex flex-wrap gap-1">
                      {previewRecipients.cc.length === 0 ? (
                        <span className="text-slate-500 italic text-[11px]">No CC recipients</span>
                      ) : (
                        previewRecipients.cc.map((e, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono border border-slate-700">
                            {e}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingAuto(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAuto}
                onClick={handleSaveEditedAuto}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                <Save size={13} />
                <span>{savingAuto ? 'Saving...' : 'Save Automation'}</span>
              </button>
            </div>
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
