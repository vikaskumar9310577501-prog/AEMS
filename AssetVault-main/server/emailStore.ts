import fs from "fs";
import path from "path";
import { isSupabaseMode } from "./sqlConfig.js";
import { DATA_BUCKET, downloadFromStorage, uploadToStorage } from "./supabaseClient.js";
import type {
  EmailTemplate,
  EmailAutomation,
  EmailDraft,
  EmailExecutionLog,
  EmailAnalytics,
} from "../src/types/emailAutomation.js";

const TEMPLATES_FILE = "email_templates";
const AUTOMATIONS_FILE = "email_automations";
const DRAFTS_FILE = "email_drafts";
const LOGS_FILE = "email_execution_logs";

function localPath(name: string): string {
  return path.join(process.cwd(), "data", `${name}.json`);
}

async function loadJson<T>(name: string, fallback: T): Promise<T> {
  if (isSupabaseMode()) {
    const remote = await downloadFromStorage(`tables/${name}.json`, DATA_BUCKET);
    if (!remote) return fallback;
    try {
      return JSON.parse(new TextDecoder().decode(remote.bytes)) as T;
    } catch {
      return fallback;
    }
  }
  try {
    const file = localPath(name);
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function saveJson(name: string, data: unknown): Promise<void> {
  if (isSupabaseMode()) {
    await uploadToStorage(
      `tables/${name}.json`,
      Buffer.from(JSON.stringify(data, null, 2)),
      "application/json",
      DATA_BUCKET
    );
    return;
  }
  const file = localPath(name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

function defaultTemplates(): EmailTemplate[] {
  const now = new Date().toISOString();
  return [
    {
      id: "tpl_overdue_pm",
      name: "Overdue Preventive Maintenance Alert",
      category: "overdue_pm",
      subject: "URGENT: Preventive Maintenance Overdue Machines - {{PlantName}}",
      bodyHtml: `<p>Dear Maintenance & Plant Leadership,</p>
<p>The following machine(s) in <strong>{{PlantName}}</strong> have exceeded their scheduled preventive maintenance date and are currently <strong>OVERDUE</strong>.</p>
<p>Immediate action is required to avoid unplanned machine breakdown and ensure equipment reliability.</p>
{{ConsolidatedTable}}
<p style="margin-top:16px;">Please assign maintenance technicians immediately and complete the maintenance in the AEMS portal.</p>`,
      variables: [
        "{{PlantName}}",
        "{{LocationName}}",
        "{{CurrentDate}}",
        "{{TotalCount}}",
        "{{ConsolidatedTable}}",
      ],
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "tpl_upcoming_pm",
      name: "Upcoming Preventive Maintenance Notice",
      category: "upcoming_pm",
      subject: "Upcoming Preventive Maintenance Schedule (Next {{ReminderDays}} Days) - {{PlantName}}",
      bodyHtml: `<p>Dear Sir / Madam,</p>
<p>This is an automated advance notification of machines due for preventive maintenance within the next <strong>{{ReminderDays}} days</strong> in <strong>{{PlantName}}</strong>.</p>
{{ConsolidatedTable}}
<p style="margin-top:16px;">Please plan necessary spare parts, tooling, and line clearance accordingly.</p>`,
      variables: [
        "{{PlantName}}",
        "{{LocationName}}",
        "{{ReminderDays}}",
        "{{TotalCount}}",
        "{{ConsolidatedTable}}",
      ],
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "tpl_complaint_created",
      name: "Breakdown Complaint Registered",
      category: "complaint_created",
      subject: "BREAKDOWN ALERT: Machine {{MachineNumber}} ({{MachineType}}) - {{PlantName}}",
      bodyHtml: `<p>A machine breakdown complaint has been registered in AEMS.</p>
<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;">
  <tr><td style="padding:6px 0;color:#64748b;width:35%;">Machine Name</td><td style="padding:6px 0;font-weight:700;">{{MachineName}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Asset Code</td><td style="padding:6px 0;font-weight:700;">{{MachineCode}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Serial Number</td><td style="padding:6px 0;font-weight:700;">{{SerialNumber}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Model Number</td><td style="padding:6px 0;font-weight:700;">{{ModelNumber}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Plant / Location</td><td style="padding:6px 0;font-weight:700;">{{PlantName}} ({{LocationName}})</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Issue Description</td><td style="padding:6px 0;font-weight:700;color:#b91c1c;">{{IssueDescription}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Reported By</td><td style="padding:6px 0;font-weight:700;">{{ReportedBy}}</td></tr>
</table>
<p>Technicians have been notified. Please address promptly to minimize line stoppage.</p>`,
      variables: [
        "{{MachineName}}",
        "{{MachineCode}}",
        "{{MachineNumber}}",
        "{{MachineType}}",
        "{{SerialNumber}}",
        "{{ModelNumber}}",
        "{{PlantName}}",
        "{{LocationName}}",
        "{{IssueDescription}}",
        "{{ReportedBy}}",
      ],
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "tpl_complaint_resolved",
      name: "Machine Breakdown Resolved",
      category: "complaint_resolved",
      subject: "RESOLVED: Breakdown Complaint on Machine {{MachineNumber}} - {{PlantName}}",
      bodyHtml: `<p>The breakdown complaint on machine <strong>{{MachineNumber}}</strong> has been marked <strong>RESOLVED</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;">
  <tr><td style="padding:6px 0;color:#64748b;width:35%;">Machine Name</td><td style="padding:6px 0;font-weight:700;">{{MachineName}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Asset Code</td><td style="padding:6px 0;font-weight:700;">{{MachineCode}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Action Taken</td><td style="padding:6px 0;font-weight:700;color:#15803d;">{{ActionTaken}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Root Cause</td><td style="padding:6px 0;font-weight:700;">{{RootCause}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Downtime</td><td style="padding:6px 0;font-weight:700;">{{Downtime}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Resolved By</td><td style="padding:6px 0;font-weight:700;">{{ResolvedBy}}</td></tr>
</table>
<p>Machine is now back in production.</p>`,
      variables: [
        "{{MachineName}}",
        "{{MachineCode}}",
        "{{MachineNumber}}",
        "{{PlantName}}",
        "{{ActionTaken}}",
        "{{RootCause}}",
        "{{Downtime}}",
        "{{ResolvedBy}}",
      ],
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "tpl_sla_breach",
      name: "Complaint SLA Breach Alert",
      category: "sla_breached",
      subject: "ESCALATION: Complaint SLA Breached for Machine {{MachineNumber}} ({{DaysOpen}} Days Open)",
      bodyHtml: `<p><strong>ATTENTION:</strong> A maintenance complaint has remained open beyond the resolution SLA window.</p>
<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;">
  <tr><td style="padding:6px 0;color:#64748b;width:35%;">Machine</td><td style="padding:6px 0;font-weight:700;">{{MachineName}} ({{MachineCode}})</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Plant</td><td style="padding:6px 0;font-weight:700;">{{PlantName}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Days Open</td><td style="padding:6px 0;font-weight:700;color:#b91c1c;">{{DaysOpen}} days</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Complaint Date</td><td style="padding:6px 0;font-weight:700;">{{ComplaintDate}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Issue</td><td style="padding:6px 0;font-weight:700;">{{IssueDescription}}</td></tr>
</table>
<p>Please escalate to the department and plant head for urgent closure.</p>`,
      variables: [
        "{{MachineName}}",
        "{{MachineCode}}",
        "{{MachineNumber}}",
        "{{PlantName}}",
        "{{DaysOpen}}",
        "{{ComplaintDate}}",
        "{{IssueDescription}}",
      ],
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "tpl_monthly_pm",
      name: "Monthly PM Summary Report",
      category: "monthly_pm",
      subject: "Monthly Preventive Maintenance Summary - {{CurrentMonth}} - {{PlantName}}",
      bodyHtml: `<p>Dear Management,</p>
<p>Here is the monthly preventive maintenance status report for <strong>{{CurrentMonth}}</strong> for <strong>{{PlantName}}</strong>.</p>
{{ConsolidatedTable}}
<p style="margin-top:16px;">This summary is automatically generated by AEMS.</p>`,
      variables: [
        "{{PlantName}}",
        "{{LocationName}}",
        "{{CurrentMonth}}",
        "{{TotalCount}}",
        "{{ConsolidatedTable}}",
      ],
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "tpl_zero_machine_entry",
      name: "Daily Machine Entry Missing Alert",
      category: "zero_machine_entry",
      subject: "ACTION REQUIRED: No Machine Entry Logged Today ({{CurrentDate}}) - {{PlantName}}",
      bodyHtml: `<p>Dear Maintenance & Plant Leadership,</p>
<p>This is an automated alert from AEMS to inform you that <strong>NO machine entries, maintenance logs, or status updates</strong> have been recorded today (<strong>{{CurrentDate}}</strong>) for <strong>{{PlantName}}</strong>.</p>
<div style="background-color:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:12px 16px;margin:16px 0;">
  <p style="margin:0;color:#9f1239;font-weight:bold;font-size:14px;">⚠️ Compliance Warning: Daily Machine Log Pending</p>
  <p style="margin:6px 0 0 0;color:#881337;font-size:12px;">Total Registered Machines in Plant: <strong>{{TotalCount}}</strong></p>
</div>
<p>Daily recording of machine health, PM activities, and status is critical to maintain equipment uptime and prevent untracked breakdowns.</p>
<p style="margin-top:16px;">Please instruct the plant maintenance team / supervisor to log in to AEMS portal and update today's machine records immediately.</p>`,
      variables: [
        "{{PlantName}}",
        "{{LocationName}}",
        "{{CurrentDate}}",
        "{{TotalCount}}",
      ],
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function defaultAutomations(): EmailAutomation[] {
  const now = new Date().toISOString();
  return [
    {
      id: "auto_overdue_pm",
      name: "Overdue PM Automated Alert",
      triggerType: "overdue_pm",
      status: "active",
      frequency: "daily",
      scheduleTimes: ["09:00", "16:00"],
      recipientRules: [
        { type: "plant_contacts", value: "HOD,FH,PH", target: "to" },
        { type: "role", value: "Maintenance Head", target: "cc" },
      ],
      templateId: "tpl_overdue_pm",
      consolidationMode: "consolidated",
      retryCount: 3,
      retryIntervalMinutes: 15,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "auto_upcoming_pm",
      name: "Upcoming PM 7-Day Alert",
      triggerType: "upcoming_pm",
      status: "active",
      frequency: "daily",
      scheduleTimes: ["08:30"],
      reminderDays: 7,
      recipientRules: [
        { type: "plant_contacts", value: "HOD,FH,PH", target: "to" },
      ],
      templateId: "tpl_upcoming_pm",
      consolidationMode: "consolidated",
      retryCount: 3,
      retryIntervalMinutes: 15,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "auto_complaint_created",
      name: "Breakdown Complaint Notification",
      triggerType: "complaint_created",
      status: "active",
      frequency: "instant",
      scheduleTimes: [],
      recipientRules: [
        { type: "plant_contacts", value: "HOD,PH", target: "to" },
      ],
      templateId: "tpl_complaint_created",
      consolidationMode: "individual",
      retryCount: 3,
      retryIntervalMinutes: 10,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "auto_complaint_resolved",
      name: "Complaint Resolved Notification",
      triggerType: "complaint_resolved",
      status: "active",
      frequency: "instant",
      scheduleTimes: [],
      recipientRules: [
        { type: "plant_contacts", value: "HOD,PH", target: "to" },
      ],
      templateId: "tpl_complaint_resolved",
      consolidationMode: "individual",
      retryCount: 3,
      retryIntervalMinutes: 10,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "auto_sla_breach",
      name: "Complaint SLA Breach Alert",
      triggerType: "sla_breached",
      status: "active",
      frequency: "daily",
      scheduleTimes: ["10:00"],
      recipientRules: [
        { type: "plant_contacts", value: "HOD,FH,PH", target: "to" },
        { type: "role", value: "IT Admin", target: "cc" },
      ],
      templateId: "tpl_sla_breach",
      consolidationMode: "individual",
      retryCount: 3,
      retryIntervalMinutes: 15,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "auto_monthly_pm",
      name: "Monthly PM Summary Report",
      triggerType: "monthly_pm",
      status: "active",
      frequency: "monthly",
      scheduleTimes: ["10:00"],
      recipientRules: [
        { type: "plant_contacts", value: "HOD,FH,PH", target: "to" },
      ],
      templateId: "tpl_monthly_pm",
      consolidationMode: "consolidated",
      retryCount: 3,
      retryIntervalMinutes: 30,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "auto_zero_machine_entry",
      name: "Daily Machine Entry Missing Alert",
      triggerType: "zero_machine_entry",
      status: "active",
      frequency: "daily",
      scheduleTimes: ["18:00"],
      recipientRules: [
        { type: "plant_contacts", value: "HOD,FH,PH", target: "to" },
        { type: "role", value: "Maintenance Head", target: "cc" },
      ],
      templateId: "tpl_zero_machine_entry",
      consolidationMode: "consolidated",
      retryCount: 3,
      retryIntervalMinutes: 15,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// Templates API
export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  const rows = await loadJson<EmailTemplate[]>(TEMPLATES_FILE, []);
  if (!Array.isArray(rows) || rows.length === 0) {
    const defaults = defaultTemplates();
    await saveJson(TEMPLATES_FILE, defaults);
    return defaults;
  }
  const defaults = defaultTemplates();
  let changed = false;
  for (const def of defaults) {
    if (!rows.some((r) => r.id === def.id)) {
      rows.push(def);
      changed = true;
    }
  }
  if (changed) {
    await saveJson(TEMPLATES_FILE, rows);
  }
  return rows;
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate | null> {
  const list = await listEmailTemplates();
  return list.find((t) => t.id === id) || null;
}

export async function upsertEmailTemplate(template: EmailTemplate): Promise<EmailTemplate> {
  const list = await listEmailTemplates();
  const idx = list.findIndex((t) => t.id === template.id);
  const now = new Date().toISOString();
  const item: EmailTemplate = {
    ...template,
    updatedAt: now,
    createdAt: template.createdAt || now,
  };
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  await saveJson(TEMPLATES_FILE, list);
  return item;
}

export async function deleteEmailTemplate(id: string): Promise<boolean> {
  const list = await listEmailTemplates();
  const next = list.filter((t) => t.id !== id);
  if (next.length === list.length) return false;
  await saveJson(TEMPLATES_FILE, next);
  return true;
}

// Automations API
export async function listEmailAutomations(): Promise<EmailAutomation[]> {
  const rows = await loadJson<EmailAutomation[]>(AUTOMATIONS_FILE, []);
  if (!Array.isArray(rows) || rows.length === 0) {
    const defaults = defaultAutomations();
    await saveJson(AUTOMATIONS_FILE, defaults);
    return defaults;
  }
  const defaults = defaultAutomations();
  let changed = false;
  for (const def of defaults) {
    if (!rows.some((r) => r.id === def.id)) {
      rows.push(def);
      changed = true;
    }
  }
  if (changed) {
    await saveJson(AUTOMATIONS_FILE, rows);
  }
  return rows;
}

export async function getEmailAutomation(id: string): Promise<EmailAutomation | null> {
  const list = await listEmailAutomations();
  return list.find((a) => a.id === id) || null;
}

export async function upsertEmailAutomation(automation: EmailAutomation): Promise<EmailAutomation> {
  const list = await listEmailAutomations();
  const idx = list.findIndex((a) => a.id === automation.id);
  const now = new Date().toISOString();
  const item: EmailAutomation = {
    ...automation,
    updatedAt: now,
    createdAt: automation.createdAt || now,
  };
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  await saveJson(AUTOMATIONS_FILE, list);
  return item;
}

export async function deleteEmailAutomation(id: string): Promise<boolean> {
  const list = await listEmailAutomations();
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return false;
  await saveJson(AUTOMATIONS_FILE, next);
  return true;
}

// Drafts API
export async function listEmailDrafts(userEmail?: string): Promise<EmailDraft[]> {
  const rows = await loadJson<EmailDraft[]>(DRAFTS_FILE, []);
  if (!Array.isArray(rows)) return [];
  if (userEmail) {
    return rows.filter((d) => d.createdBy.toLowerCase() === userEmail.toLowerCase());
  }
  return rows;
}

export async function getEmailDraft(id: string): Promise<EmailDraft | null> {
  const list = await listEmailDrafts();
  return list.find((d) => d.id === id) || null;
}

export async function upsertEmailDraft(draft: EmailDraft): Promise<EmailDraft> {
  const list = await listEmailDrafts();
  const idx = list.findIndex((d) => d.id === draft.id);
  const now = new Date().toISOString();
  const item: EmailDraft = {
    ...draft,
    updatedAt: now,
    createdAt: draft.createdAt || now,
  };
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  await saveJson(DRAFTS_FILE, list);
  return item;
}

export async function deleteEmailDraft(id: string): Promise<boolean> {
  const list = await listEmailDrafts();
  const next = list.filter((d) => d.id !== id);
  if (next.length === list.length) return false;
  await saveJson(DRAFTS_FILE, next);
  return true;
}

// Execution Logs API
export async function listEmailLogs(limit = 200): Promise<EmailExecutionLog[]> {
  const rows = await loadJson<EmailExecutionLog[]>(LOGS_FILE, []);
  if (!Array.isArray(rows)) return [];
  return rows.slice(-limit).reverse();
}

export async function appendEmailLog(log: Omit<EmailExecutionLog, "id">): Promise<EmailExecutionLog> {
  const rows = await loadJson<EmailExecutionLog[]>(LOGS_FILE, []);
  const item: EmailExecutionLog = {
    ...log,
    id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  };
  rows.push(item);
  if (rows.length > 2000) rows.splice(0, rows.length - 2000);
  await saveJson(LOGS_FILE, rows);
  return item;
}

export async function isIdempotentAlreadySent(idempotencyKey: string): Promise<boolean> {
  if (!idempotencyKey) return false;
  const rows = await loadJson<EmailExecutionLog[]>(LOGS_FILE, []);
  return rows.some((r) => r.idempotencyKey === idempotencyKey && r.status === "sent");
}

export async function getEmailAnalytics(): Promise<EmailAnalytics> {
  const logs = await loadJson<EmailExecutionLog[]>(LOGS_FILE, []);
  const automations = await listEmailAutomations();
  const drafts = await listEmailDrafts();

  let sent = 0;
  let failed = 0;
  let retrying = 0;
  const byCategory: Record<string, number> = {};
  const trendMap: Record<string, { sent: number; failed: number }> = {};

  for (const log of logs) {
    if (log.status === "sent") sent++;
    else if (log.status === "failed") failed++;
    else if (log.status === "retrying") retrying++;

    const cat = log.triggerType || "other";
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    const d = log.date || "Unknown";
    if (!trendMap[d]) trendMap[d] = { sent: 0, failed: 0 };
    if (log.status === "sent") trendMap[d].sent++;
    if (log.status === "failed") trendMap[d].failed++;
  }

  const sortedDates = Object.keys(trendMap).sort().slice(-14);
  const trend = sortedDates.map((date) => ({
    date,
    sent: trendMap[date].sent,
    failed: trendMap[date].failed,
  }));

  return {
    totalEmails: logs.length,
    sent,
    failed,
    retrying,
    scheduledAutomations: automations.filter((a) => a.status === "active").length,
    drafts: drafts.length,
    byCategory,
    trend,
  };
}
