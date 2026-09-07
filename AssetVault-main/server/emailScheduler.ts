import {
  listEmailAutomations,
  getEmailTemplate,
  appendEmailLog,
  isIdempotentAlreadySent,
} from "./emailStore.js";
import {
  listMaintenanceMachines,
  listMaintenanceComplaints,
  getMaintenanceMeta,
} from "./maintenanceStore.js";
import { sendMaintenanceMail } from "./maintenanceMail.js";
import {
  daysUntilDateIst,
  istTodayKey,
  effectiveNextMaintenanceDate,
  COMPLAINT_RESOLVE_SLA_DAYS,
} from "../src/lib/maintenanceCodes.js";
import { plantShortName } from "../src/lib/plantDisplay.js";
import { APP_NAME } from "../src/lib/constants.js";
import type {
  EmailAutomation,
  EmailTemplate,
  EmailTriggerType,
} from "../src/types/emailAutomation.js";
import type { MaintenanceMachine, MaintenanceComplaint } from "../src/types/maintenance.js";

/** Current time in IST as "HH:MM" */
export function currentIstTime(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return parts; // e.g. "09:05"
}

/** Current IST date as YYYY-MM-DD */
export function currentIstDate(): string {
  return istTodayKey();
}

/** Escape HTML entities */
function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Professional styled HTML shell */
function professionalShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:700px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
        <tr><td style="background:#113355;padding:20px 28px;">
          <h1 style="margin:0;color:#fff;font-size:18px;font-weight:800;">${APP_NAME}</h1>
          <p style="margin:6px 0 0;color:#93c5fd;font-size:12px;font-weight:600;">Preventive Maintenance & Equipment Notification</p>
        </td></tr>
        <tr><td style="padding:28px;color:#334155;font-size:14px;line-height:1.65;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">This is an automated consolidated notification from ${APP_NAME}. Please do not reply directly to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Build a consolidated HTML table of machines */
export function renderMachineConsolidatedTable(
  machines: MaintenanceMachine[],
  type: "overdue" | "upcoming" | "monthly"
): string {
  if (machines.length === 0) {
    return `<p style="font-style:italic;color:#64748b;">No machines found in this category.</p>`;
  }

  const isOverdue = type === "overdue";
  const headerCol = isOverdue ? "Days Overdue" : type === "upcoming" ? "Days Left" : "Status";

  const rowsHtml = machines
    .map((m, idx) => {
      const dueDate = effectiveNextMaintenanceDate(m);
      const days = daysUntilDateIst(dueDate);
      const daysLabel =
        isOverdue
          ? `<span style="color:#b91c1c;font-weight:700;">${Math.abs(days || 0)}d late</span>`
          : type === "upcoming"
          ? `<span style="color:#2563eb;font-weight:700;">${days ?? 0}d left</span>`
          : `<span style="color:#15803d;font-weight:700;">${m.status || "Active"}</span>`;

      const machineName = m.equipmentName?.trim() || `${m.machineType} ${m.machineNumber}`.trim();
      const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";

      return `<tr style="background:${bg};border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 8px;font-weight:700;color:#0f172a;">${escapeHtml(machineName)}</td>
        <td style="padding:10px 8px;font-family:monospace;font-size:12px;font-weight:700;color:#1d4ed8;">${escapeHtml(m.assetCode || "")}</td>
        <td style="padding:10px 8px;font-family:monospace;font-size:11px;font-weight:600;color:#475569;">${escapeHtml(m.serialNumber || "—")}</td>
        <td style="padding:10px 8px;font-size:12px;color:#475569;">${escapeHtml(m.modelNumber || "—")}</td>
        <td style="padding:10px 8px;font-size:12px;font-weight:600;color:#334155;">${escapeHtml(plantShortName(m.plantCode))}</td>
        <td style="padding:10px 8px;font-size:12px;color:#64748b;">${escapeHtml(m.department || "—")}</td>
        <td style="padding:10px 8px;font-size:12px;font-weight:600;color:#0f172a;">${escapeHtml(dueDate || "—")}</td>
        <td style="padding:10px 8px;font-size:12px;text-align:center;">${daysLabel}</td>
        <td style="padding:10px 8px;font-size:12px;color:#475569;">${escapeHtml(m.responsibility || "Unassigned")}</td>
      </tr>`;
    })
    .join("");

  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;">
    <thead>
      <tr style="background:#0f172a;color:#ffffff;text-align:left;">
        <th style="padding:10px 8px;font-weight:700;">Machine</th>
        <th style="padding:10px 8px;font-weight:700;">Code</th>
        <th style="padding:10px 8px;font-weight:700;">Serial No.</th>
        <th style="padding:10px 8px;font-weight:700;">Model No.</th>
        <th style="padding:10px 8px;font-weight:700;">Plant</th>
        <th style="padding:10px 8px;font-weight:700;">Department</th>
        <th style="padding:10px 8px;font-weight:700;">Due Date</th>
        <th style="padding:10px 8px;font-weight:700;text-align:center;">${headerCol}</th>
        <th style="padding:10px 8px;font-weight:700;">Responsible</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>`;
}

/** Plain text representation of consolidated table */
function renderPlainTextTable(machines: MaintenanceMachine[], type: "overdue" | "upcoming" | "monthly"): string {
  const isOverdue = type === "overdue";
  return machines
    .map((m, i) => {
      const dueDate = effectiveNextMaintenanceDate(m);
      const days = daysUntilDateIst(dueDate);
      const statusStr = isOverdue ? `${Math.abs(days || 0)}d overdue` : `${days ?? 0}d remaining`;
      return `${i + 1}. ${m.equipmentName || m.machineType} (${m.assetCode}) | SN: ${m.serialNumber || '—'} | Model: ${m.modelNumber || '—'} | Plant: ${m.plantCode} | Due: ${dueDate} | ${statusStr} | Resp: ${m.responsibility || 'Unassigned'}`;
    })
    .join("\n");
}

/** Resolve recipients for a given automation and machine/plant context */
export function resolveRecipients(
  automation: EmailAutomation,
  plantContacts: Record<string, any>,
  plants: string[]
): { to: string[]; cc: string[]; bcc: string[] } {
  const toSet = new Set<string>();
  const ccSet = new Set<string>();
  const bccSet = new Set<string>();

  for (const rule of automation.recipientRules || []) {
    const target = rule.target || "to";
    const targetSet = target === "cc" ? ccSet : target === "bcc" ? bccSet : toSet;

    if (rule.type === "plant_contacts") {
      const roles = (rule.value || "HOD,FH,PH").toUpperCase().split(",").map((s) => s.trim());
      for (const p of plants) {
        let contact = plantContacts[p] || plantContacts[p.toUpperCase()] || plantContacts[p.toLowerCase()];
        if (!contact) {
          const normP = p.trim().toLowerCase();
          for (const [k, v] of Object.entries(plantContacts)) {
            const normK = k.trim().toLowerCase();
            if (normK === normP || normP.includes(normK) || normK.includes(normP)) {
              contact = v;
              break;
            }
          }
        }
        if (contact) {
          if (roles.includes("HOD") && contact.hodEmail) targetSet.add(contact.hodEmail.trim().toLowerCase());
          if (roles.includes("FH") && contact.fhEmail) targetSet.add(contact.fhEmail.trim().toLowerCase());
          if (roles.includes("PH") && contact.phEmail) targetSet.add(contact.phEmail.trim().toLowerCase());
        }
      }
    } else if (rule.type === "manual_email" || rule.value.includes("@")) {
      const emails = rule.value.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));
      for (const e of emails) targetSet.add(e);
    }
  }

  return {
    to: Array.from(toSet).filter(Boolean),
    cc: Array.from(ccSet).filter(Boolean),
    bcc: Array.from(bccSet).filter(Boolean),
  };
}

/** Check if scheduled automation should run at the current hour/minute */
function isTimeMatch(scheduledTimes: string[], currentIst: string): boolean {
  if (!scheduledTimes || scheduledTimes.length === 0) return true; // immediate / hourly
  const [currH, currM] = currentIst.split(":").map((n) => parseInt(n, 10));
  return scheduledTimes.some((timeStr) => {
    const [h, m] = timeStr.split(":").map((n) => parseInt(n, 10));
    // Match within 15-minute window so interval doesn't skip
    const diff = Math.abs(currH * 60 + currM - (h * 60 + m));
    return diff <= 5;
  });
}

/** Main evaluation engine for email automations */
export async function runEmailAutomationScheduler(force = false): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const date = currentIstDate();
  const time = currentIstTime();
  const automations = await listEmailAutomations();
  const activeAutomations = automations.filter((a) => a.status === "active");

  const meta = await getMaintenanceMeta();
  const plantContacts = meta.plantContacts || {};
  const allMachines = await listMaintenanceMachines();
  const activeMachines = allMachines.filter((m) => m.status !== "Decommissioned");

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const auto of activeAutomations) {
    // Check timing unless force is requested
    if (!force && !isTimeMatch(auto.scheduleTimes, time)) {
      continue;
    }

    processed++;

    try {
      const template = (await getEmailTemplate(auto.templateId)) || {
        id: auto.templateId,
        name: auto.name,
        category: auto.triggerType,
        subject: `${auto.name} - {{PlantName}}`,
        bodyHtml: `<p>Notification for {{PlantName}}</p>{{ConsolidatedTable}}`,
        variables: [],
        status: "active",
        createdAt: "",
        updatedAt: "",
      };

      if (auto.triggerType === "overdue_pm") {
        // Find overdue machines
        const overdueMachines = activeMachines.filter((m) => {
          const due = effectiveNextMaintenanceDate(m);
          const days = daysUntilDateIst(due);
          return days != null && days < 0;
        });

        if (overdueMachines.length === 0) {
          skipped++;
          continue;
        }

        // Group machines by plant (or consolidated multi-plant)
        const plantGroups: Record<string, MaintenanceMachine[]> = {};
        for (const m of overdueMachines) {
          const p = m.plantCode || "General";
          if (!plantGroups[p]) plantGroups[p] = [];
          plantGroups[p].push(m);
        }

        for (const [plantCode, machines] of Object.entries(plantGroups)) {
          const idempotencyKey = `${auto.id}_${date}_${time.slice(0, 2)}_${plantCode}`;
          if (!force && (await isIdempotentAlreadySent(idempotencyKey))) {
            skipped++;
            continue;
          }

          const recipients = resolveRecipients(auto, plantContacts, [plantCode]);
          if (recipients.to.length === 0) {
            skipped++;
            continue;
          }

          const tableHtml = renderMachineConsolidatedTable(machines, "overdue");
          const tableText = renderPlainTextTable(machines, "overdue");
          const plantName = plantShortName(plantCode);

          let subject = template.subject
            .replace(/\{\{PlantName\}\}/g, plantName)
            .replace(/\{\{TotalCount\}\}/g, String(machines.length))
            .replace(/\{\{CurrentDate\}\}/g, date);

          let bodyHtml = template.bodyHtml
            .replace(/\{\{PlantName\}\}/g, plantName)
            .replace(/\{\{TotalCount\}\}/g, String(machines.length))
            .replace(/\{\{CurrentDate\}\}/g, date)
            .replace(/\{\{ConsolidatedTable\}\}/g, tableHtml);

          const fullHtml = professionalShell(subject, bodyHtml);
          const fullText = `Preventive Maintenance Overdue Machines - ${plantName}\n\nTotal Overdue: ${machines.length}\n\n${tableText}\n\n${APP_NAME}`;

          const sendResult = await sendMaintenanceMail({
            to: recipients.to,
            cc: recipients.cc,
            bcc: recipients.bcc,
            subject,
            html: fullHtml,
            text: fullText,
          });

          await appendEmailLog({
            automationId: auto.id,
            automationName: auto.name,
            triggerType: auto.triggerType,
            idempotencyKey,
            date,
            time,
            sender: APP_NAME,
            to: recipients.to,
            cc: recipients.cc,
            bcc: recipients.bcc,
            subject,
            plantCode,
            status: sendResult.ok ? "sent" : "failed",
            sentAt: sendResult.ok ? new Date().toISOString() : undefined,
            failureReason: sendResult.error,
            retryCount: sendResult.ok ? 0 : 1,
            machineCount: machines.length,
          });

          if (sendResult.ok) sent++;
          else errors.push(`[${plantCode}] ${sendResult.error}`);
        }
      } else if (auto.triggerType === "upcoming_pm") {
        const reminderDays = auto.reminderDays || 7;
        const upcomingMachines = activeMachines.filter((m) => {
          const due = effectiveNextMaintenanceDate(m);
          const days = daysUntilDateIst(due);
          return days != null && days >= 0 && days <= reminderDays;
        });

        if (upcomingMachines.length === 0) {
          skipped++;
          continue;
        }

        const plantGroups: Record<string, MaintenanceMachine[]> = {};
        for (const m of upcomingMachines) {
          const p = m.plantCode || "General";
          if (!plantGroups[p]) plantGroups[p] = [];
          plantGroups[p].push(m);
        }

        for (const [plantCode, machines] of Object.entries(plantGroups)) {
          const idempotencyKey = `${auto.id}_${date}_upcoming_${plantCode}`;
          if (!force && (await isIdempotentAlreadySent(idempotencyKey))) {
            skipped++;
            continue;
          }

          const recipients = resolveRecipients(auto, plantContacts, [plantCode]);
          if (recipients.to.length === 0) {
            skipped++;
            continue;
          }

          const tableHtml = renderMachineConsolidatedTable(machines, "upcoming");
          const tableText = renderPlainTextTable(machines, "upcoming");
          const plantName = plantShortName(plantCode);

          let subject = template.subject
            .replace(/\{\{PlantName\}\}/g, plantName)
            .replace(/\{\{ReminderDays\}\}/g, String(reminderDays))
            .replace(/\{\{TotalCount\}\}/g, String(machines.length));

          let bodyHtml = template.bodyHtml
            .replace(/\{\{PlantName\}\}/g, plantName)
            .replace(/\{\{ReminderDays\}\}/g, String(reminderDays))
            .replace(/\{\{TotalCount\}\}/g, String(machines.length))
            .replace(/\{\{ConsolidatedTable\}\}/g, tableHtml);

          const fullHtml = professionalShell(subject, bodyHtml);
          const fullText = `Upcoming PM Schedule (${reminderDays} Days) - ${plantName}\n\nTotal Due: ${machines.length}\n\n${tableText}\n\n${APP_NAME}`;

          const sendResult = await sendMaintenanceMail({
            to: recipients.to,
            cc: recipients.cc,
            bcc: recipients.bcc,
            subject,
            html: fullHtml,
            text: fullText,
          });

          await appendEmailLog({
            automationId: auto.id,
            automationName: auto.name,
            triggerType: auto.triggerType,
            idempotencyKey,
            date,
            time,
            sender: APP_NAME,
            to: recipients.to,
            cc: recipients.cc,
            bcc: recipients.bcc,
            subject,
            plantCode,
            status: sendResult.ok ? "sent" : "failed",
            sentAt: sendResult.ok ? new Date().toISOString() : undefined,
            failureReason: sendResult.error,
            retryCount: sendResult.ok ? 0 : 1,
            machineCount: machines.length,
          });

          if (sendResult.ok) sent++;
          else errors.push(`[${plantCode}] ${sendResult.error}`);
        }
      }
    } catch (err: any) {
      errors.push(`[${auto.name}] ${err.message || String(err)}`);
    }
  }

  return { processed, sent, skipped, errors };
}

/** In-process scheduler timer */
let timerRef: NodeJS.Timeout | null = null;

export function startEmailSchedulerTimer(): void {
  if (timerRef) return;
  console.log("[EmailScheduler] Background scheduler initialized (runs every 60s in IST)");
  // Run check every 60 seconds
  timerRef = setInterval(() => {
    runEmailAutomationScheduler(false).catch((err) => {
      console.warn("[EmailScheduler] Scheduler cycle error:", err);
    });
  }, 60000);
}

export function stopEmailSchedulerTimer(): void {
  if (timerRef) {
    clearInterval(timerRef);
    timerRef = null;
  }
}
