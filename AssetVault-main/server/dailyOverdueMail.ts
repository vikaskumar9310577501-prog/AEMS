import { appendEmailLog, isIdempotentAlreadySent } from "./emailStore.js";
import { listMaintenanceMachines } from "./maintenanceStore.js";
import { sendMaintenanceMail } from "./maintenanceMail.js";
import { renderMachineConsolidatedTable } from "./emailScheduler.js";
import {
  daysUntilDateIst,
  effectiveNextMaintenanceDate,
  istHour,
  istTodayKey,
} from "../src/lib/maintenanceCodes.js";
import { APP_NAME } from "../src/lib/constants.js";
import type { MaintenanceMachine } from "../src/types/maintenance.js";

/** One consolidated overdue mail per plant, every day at 09:00 IST. */
export const DAILY_OVERDUE_MAIL_HOUR_IST = 9;

const CC = ["naresh.kukreja@pgel.in", "dhruv.tak4@pgel.in", "software.2040@pgel.in"];

export const DAILY_OVERDUE_PLANTS: Array<{ code: string; name: string; to: string[] }> = [
  { code: "4010", name: "NGM", to: ["anil.more4@pgel.in"] },
  { code: "2020", name: "PGTL", to: ["sandeep.auti@pgel.in", "sandeep.auti4@pgel.in"] },
  { code: "1040", name: "PGEL", to: ["sandeep.auti@pgel.in", "sandeep.auti4@pgel.in"] },
];

const DAILY_OVERDUE_PLANT_CODES = new Set(DAILY_OVERDUE_PLANTS.map((p) => p.code));

export function isDailyOverduePlant(plantCode: string | undefined | null): boolean {
  return DAILY_OVERDUE_PLANT_CODES.has(String(plantCode || "").trim());
}

function shell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:920px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#113355;padding:20px 28px;">
          <h1 style="margin:0;color:#fff;font-size:18px;font-weight:800;">${APP_NAME}</h1>
          <p style="margin:6px 0 0;color:#93c5fd;font-size:12px;font-weight:600;">Overdue Preventive Maintenance</p>
        </td></tr>
        <tr><td style="padding:28px;color:#334155;font-size:14px;line-height:1.65;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">This is an automated notification from ${APP_NAME}. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function istTimeLabel(d = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export async function sendDailyOverduePlantMails(opts?: { force?: boolean; ignoreHour?: boolean }): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const force = Boolean(opts?.force);
  const ignoreHour = Boolean(opts?.ignoreHour);
  // From 9:00 IST onward, so a run missed by sleep or late cron still sends once that day.
  if (!force && !ignoreHour && istHour() < DAILY_OVERDUE_MAIL_HOUR_IST) {
    return { sent: 0, skipped: 0, errors: [] };
  }

  const date = istTodayKey();
  const time = istTimeLabel();
  const machines = await listMaintenanceMachines();
  const overdue = machines.filter((m) => {
    if (String(m.status) === "Decommissioned") return false;
    const days = daysUntilDateIst(effectiveNextMaintenanceDate(m));
    return days != null && days < 0;
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const plant of DAILY_OVERDUE_PLANTS) {
    const idempotencyKey = `daily_overdue_${date}_${plant.code}`;
    if (!force && (await isIdempotentAlreadySent(idempotencyKey))) {
      skipped++;
      continue;
    }

    const rows = overdue
      .filter((m) => String(m.plantCode) === plant.code)
      .sort((a, b) => {
        const da = daysUntilDateIst(effectiveNextMaintenanceDate(a)) ?? 0;
        const db = daysUntilDateIst(effectiveNextMaintenanceDate(b)) ?? 0;
        return da - db;
      });

    if (rows.length === 0) {
      skipped++;
      continue;
    }

    const subject = `URGENT: Preventive Maintenance Overdue Machines - ${plant.name} (${rows.length})`;
    const tableHtml = renderMachineConsolidatedTable(rows as MaintenanceMachine[], "overdue");
    const body = `<p>Dear Sir,</p>
<p>The following machine(s) in <strong>${plant.name}</strong> have passed their scheduled preventive maintenance date and are currently <strong>OVERDUE</strong>.</p>
<p>Total overdue machines: <strong>${rows.length}</strong>. Date: ${date}.</p>
<p>Please arrange maintenance and mark the machines as Done in the AEMS Preventive Setup module.</p>
${tableHtml}`;
    const text = `Overdue preventive maintenance — ${plant.name}\nTotal: ${rows.length}\nDate: ${date}\n\n${rows
      .map((m, i) => {
        const due = effectiveNextMaintenanceDate(m);
        const days = Math.abs(daysUntilDateIst(due) || 0);
        return `${i + 1}. ${m.equipmentName || m.machineType} (${m.assetCode}) | Due: ${due} | ${days} days overdue`;
      })
      .join("\n")}`;

    const result = await sendMaintenanceMail({
      to: plant.to,
      cc: CC,
      subject,
      html: shell(subject, body),
      text,
    });

    await appendEmailLog({
      automationId: "daily_overdue_9am",
      automationName: "Daily Overdue PM Alert (9:00 IST)",
      triggerType: "overdue_pm",
      idempotencyKey,
      date,
      time,
      sender: APP_NAME,
      to: plant.to,
      cc: CC,
      bcc: [],
      subject,
      plantCode: plant.code,
      status: result.ok ? "sent" : "failed",
      sentAt: result.ok ? new Date().toISOString() : undefined,
      failureReason: result.error,
      retryCount: result.ok ? 0 : 1,
      machineCount: rows.length,
    });

    if (result.ok) sent++;
    else errors.push(`[${plant.name}] ${result.error || "send failed"}`);
  }

  return { sent, skipped, errors };
}
