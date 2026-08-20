import nodemailer from "nodemailer";
import { getEnv } from "./env.js";
import { APP_NAME } from "../src/lib/constants.js";
import type { MaintenancePlantContact } from "../src/types/maintenance.js";
import { trendMonthsLabel } from "../src/types/maintenance.js";
import { istTodayKey } from "../src/lib/maintenanceCodes.js";
import { plantShortName } from "../src/lib/plantDisplay.js";

export type MachineMailIdentity = {
  assetCode: string;
  machineType: string;
  machineNumber: string;
  equipmentName?: string;
  department?: string;
  responsibility?: string;
  location: string;
  plantCode: string;
};

export function pickMailIdentity(m: MachineMailIdentity): MachineMailIdentity {
  return {
    assetCode: m.assetCode,
    machineType: m.machineType,
    machineNumber: m.machineNumber,
    equipmentName: m.equipmentName,
    department: m.department,
    responsibility: m.responsibility,
    location: m.location,
    plantCode: m.plantCode,
  };
}

/** HOD + FH + PH emails for a plant (deduped). */
export function getPlantMaintenanceEmails(
  plantContacts: Record<string, MaintenancePlantContact> | undefined,
  plantCode: string
): string[] {
  const c =
    plantContacts?.[plantCode] ||
    plantContacts?.[plantCode.toUpperCase()] ||
    plantContacts?.[plantCode.toLowerCase()] ||
    {};
  return Array.from(
    new Set(
      [c.hodEmail, c.fhEmail, c.phEmail]
        .map((e) => String(e || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function professionalShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
        <tr><td style="background:#113355;padding:20px 28px;">
          <h1 style="margin:0;color:#fff;font-size:18px;font-weight:800;">${APP_NAME}</h1>
          <p style="margin:6px 0 0;color:#93c5fd;font-size:12px;font-weight:600;">Maintenance Notification</p>
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

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function kvRow(label: string, value: string, valueStyle = ""): string {
  return `<tr><td style="padding:6px 0;color:#64748b;width:42%;">${label}</td><td style="padding:6px 0;font-weight:700;${valueStyle}">${escapeHtml(value)}</td></tr>`;
}

function identityHtml(m: MachineMailIdentity): string {
  return [
    kvRow("Machine / Equipment", String(m.equipmentName || "").trim() || m.machineType),
    kvRow("Asset Code", m.assetCode),
    kvRow("Machine Type", m.machineType),
    kvRow("Machine Number", m.machineNumber),
    kvRow("Department", String(m.department || "").trim() || "—"),
    kvRow("Responsibility", String(m.responsibility || "").trim() || "Not assigned"),
    kvRow("Location", m.location),
    kvRow("Plant", plantShortName(m.plantCode)),
  ].join("");
}

function identityText(m: MachineMailIdentity): string {
  return [
    `Machine / Equipment: ${String(m.equipmentName || "").trim() || m.machineType}`,
    `Asset Code: ${m.assetCode}`,
    `Machine Type: ${m.machineType}`,
    `Machine Number: ${m.machineNumber}`,
    `Department: ${String(m.department || "").trim() || "—"}`,
    `Responsibility: ${String(m.responsibility || "").trim() || "Not assigned"}`,
    `Location: ${m.location}`,
    `Plant: ${plantShortName(m.plantCode)}`,
  ].join("\n");
}

function reminderHtml(count?: number): string {
  if (!count || count < 1) return "";
  return kvRow("Reminder Count", String(count), "color:#b91c1c;");
}

function reminderText(count?: number): string {
  if (!count || count < 1) return "";
  return `Reminder Count: ${count}`;
}

function daysRemainingLabel(days: number): string {
  if (days === 0) return "Due today";
  if (days === 1) return "1 day remaining";
  return `${days} days remaining`;
}

export function buildPreventiveReminderEmail(m: MachineMailIdentity & {
  nextMaintenanceDate: string;
  reminderCount?: number;
  daysRemaining?: number;
}): { subject: string; html: string; text: string } {
  const remaining = m.daysRemaining ?? 0;
  const countBit = m.reminderCount ? ` | Reminder ${m.reminderCount}` : "";
  const subject = `Preventive Maintenance Reminder${countBit} — ${m.assetCode} (${daysRemainingLabel(remaining)})`;
  const intro =
    remaining === 0
      ? "This is a reminder that preventive maintenance for the machine below is due today."
      : `This is a reminder that preventive maintenance for the machine below is due in ${remaining} day${remaining === 1 ? "" : "s"}. Daily reminders will continue until the work is marked as Done.`;
  const extra = [
    identityText(m),
    `Scheduled Maintenance Date: ${m.nextMaintenanceDate}`,
    `Days Remaining: ${remaining === 0 ? "Due today" : String(remaining)}`,
    reminderText(m.reminderCount),
  ]
    .filter(Boolean)
    .join("\n");
  const text = `Dear Sir / Madam,

${intro}

${extra}

Please complete the maintenance on or before the scheduled date and mark it as Done in the AEMS Maintenance module.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>${intro}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(m)}
      ${kvRow("Scheduled Date", m.nextMaintenanceDate)}
      ${kvRow("Days Remaining", remaining === 0 ? "Due today" : String(remaining))}
      ${reminderHtml(m.reminderCount)}
    </table>
    <p>Please complete the maintenance on or before the scheduled date and mark it as <strong>Done</strong> in the AEMS Maintenance module.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}

export function buildPreventiveOverdueEmail(m: MachineMailIdentity & {
  nextMaintenanceDate: string;
  pendingDays: number;
  reminderCount?: number;
}): { subject: string; html: string; text: string } {
  const countBit = m.reminderCount ? ` | Reminder ${m.reminderCount}` : "";
  const overdueLabel = m.pendingDays === 1 ? "1 day overdue" : `${m.pendingDays} days overdue`;
  const subject = `Overdue Maintenance Reminder${countBit} — ${m.assetCode} (${overdueLabel})`;
  const extra = [
    identityText(m),
    `Scheduled Maintenance Date: ${m.nextMaintenanceDate}`,
    `Days Overdue: ${m.pendingDays}`,
    reminderText(m.reminderCount),
  ]
    .filter(Boolean)
    .join("\n");
  const text = `Dear Sir / Madam,

This is an overdue reminder. Preventive maintenance for the machine below was not completed on the scheduled date and has not been marked as Done.

${extra}

Please complete the maintenance without further delay and update the status as Done in the AEMS Maintenance module. Overdue reminders will continue twice daily at 9:00 AM and 4:00 PM IST until the work is closed.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>This is an <strong>overdue reminder</strong>. Preventive maintenance for the machine below was not completed on the scheduled date and has not been marked as Done.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(m)}
      ${kvRow("Scheduled Date", m.nextMaintenanceDate)}
      ${kvRow("Days Overdue", String(m.pendingDays), "color:#b91c1c;")}
      ${reminderHtml(m.reminderCount)}
    </table>
    <p>Please complete the maintenance without further delay and update the status as <strong>Done</strong> in the AEMS Maintenance module. Overdue reminders will continue twice daily at 9:00 AM and 4:00 PM IST until the work is closed.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}

export function buildPreventiveSolvedEmail(m: MachineMailIdentity & {
  completedOn: string;
  plannedDate: string;
  reminderCount?: number;
  resolvedBy: string;
}): { subject: string; html: string; text: string } {
  const subject = `Maintenance Completed — ${m.assetCode} (${m.machineNumber})`;
  const extra = [
    identityText(m),
    `Planned Date: ${m.plannedDate}`,
    `Completed On: ${m.completedOn}`,
    `Closed By: ${m.resolvedBy}`,
    reminderText(m.reminderCount),
  ]
    .filter(Boolean)
    .join("\n");
  const text = `Dear Sir / Madam,

Preventive maintenance for the machine below has been completed and marked as Done.

${extra}

No further reminders will be issued for this maintenance cycle.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>Preventive maintenance for the machine below has been completed and marked as <strong>Done</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(m)}
      ${kvRow("Planned Date", m.plannedDate)}
      ${kvRow("Completed On", m.completedOn)}
      ${kvRow("Closed By", m.resolvedBy)}
      ${reminderHtml(m.reminderCount)}
    </table>
    <p>No further reminders will be issued for this maintenance cycle.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}

export function buildComplaintNotifyEmail(c: MachineMailIdentity & {
  complaintText: string;
  remark?: string;
  downtimeLabel?: string;
  photoUrl?: string;
  reportedAt: string;
}): { subject: string; html: string; text: string } {
  const extraText = [
    identityText(c),
    `Reported At: ${c.reportedAt}`,
    c.downtimeLabel ? `Downtime: ${c.downtimeLabel}` : "",
    c.remark ? `Remark:\n${c.remark}` : "",
    c.photoUrl ? `Photo: ${c.photoUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const subject = `Downtime Complaint Registered — ${c.assetCode} (${c.machineNumber})`;
  const text = `Dear Sir / Madam,

A downtime complaint has been registered for the machine below. Please review the details and arrange for resolution.

${extraText}

Complaint Details:
${c.complaintText}

Please mark the complaint as Done in the AEMS Maintenance module once the issue has been resolved. Daily reminders will continue until then.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>A <strong>downtime complaint</strong> has been registered for the machine below. Please review the details and arrange for resolution.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(c)}
      ${kvRow("Reported At", c.reportedAt)}
      ${c.downtimeLabel ? kvRow("Downtime", c.downtimeLabel) : ""}
    </table>
    <p style="margin:0 0 8px;font-weight:700;">Complaint Details</p>
    <div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;">${escapeHtml(c.complaintText)}</div>
    ${c.remark ? `<p style="margin:16px 0 8px;font-weight:700;">Remark</p><div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;">${escapeHtml(c.remark)}</div>` : ""}
    ${c.photoUrl ? `<p style="margin:16px 0 8px;font-weight:700;">Photo</p><p><a href="${escapeHtml(c.photoUrl)}">View photo</a></p><p><img src="${escapeHtml(c.photoUrl)}" alt="Complaint photo" style="max-width:100%;border-radius:10px;border:1px solid #e2e8f0;" /></p>` : ""}
    <p style="margin-top:16px;">Please mark the complaint as <strong>Done</strong> in the AEMS Maintenance module once the issue has been resolved. Daily reminders will continue until then.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}

export function buildComplaintPendingEmail(c: MachineMailIdentity & {
  complaintText: string;
  pendingDays: number;
  reminderCount?: number;
}): { subject: string; html: string; text: string } {
  const countBit = c.reminderCount ? ` | Reminder ${c.reminderCount}` : "";
  const subject = `Downtime Complaint Reminder${countBit} — ${c.assetCode} (${c.pendingDays} day${c.pendingDays === 1 ? "" : "s"} pending)`;
  const extra = [identityText(c), `Days Pending: ${c.pendingDays}`, reminderText(c.reminderCount)]
    .filter(Boolean)
    .join("\n");
  const text = `Dear Sir / Madam,

This is a reminder that the downtime complaint below remains unresolved.

${extra}

Complaint:
${c.complaintText}

Please complete the resolution and mark the complaint as Done in the AEMS Maintenance module. Reminders will continue until the complaint is closed.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>This is a reminder that the downtime complaint below remains <strong>unresolved</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(c)}
      ${kvRow("Days Pending", String(c.pendingDays), "color:#b91c1c;")}
      ${reminderHtml(c.reminderCount)}
    </table>
    <p style="margin:0 0 8px;font-weight:700;">Complaint</p>
    <div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;">${escapeHtml(c.complaintText)}</div>
    <p style="margin-top:16px;">Please complete the resolution and mark the complaint as <strong>Done</strong> in the AEMS Maintenance module. Reminders will continue until the complaint is closed.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}

export function buildComplaintOverOneWeekEmail(c: MachineMailIdentity & {
  complaintText: string;
  reportedAt: string;
  pendingDays: number;
  reminderCount?: number;
}): { subject: string; html: string; text: string } {
  const countBit = c.reminderCount ? ` | Reminder ${c.reminderCount}` : "";
  const subject = `Overdue Downtime Complaint${countBit} — ${c.assetCode} (${c.pendingDays} days pending)`;
  const extra = [
    identityText(c),
    `Reported At: ${c.reportedAt}`,
    `Days Pending: ${c.pendingDays}`,
    reminderText(c.reminderCount),
  ]
    .filter(Boolean)
    .join("\n");
  const text = `Dear Sir / Madam,

This is an overdue reminder. The downtime complaint below has remained unresolved for more than seven days and requires immediate attention.

${extra}

Complaint:
${c.complaintText}

Please resolve the issue and mark the complaint as Done in the AEMS Maintenance module. Overdue reminders will continue twice daily at 9:00 AM and 4:00 PM IST until the complaint is closed.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>This is an <strong>overdue reminder</strong>. The downtime complaint below has remained unresolved for more than seven days and requires immediate attention.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(c)}
      ${kvRow("Reported At", c.reportedAt)}
      ${kvRow("Days Pending", String(c.pendingDays), "color:#b91c1c;")}
      ${reminderHtml(c.reminderCount)}
    </table>
    <p style="margin:0 0 8px;font-weight:700;">Complaint</p>
    <div style="padding:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;white-space:pre-wrap;">${escapeHtml(c.complaintText)}</div>
    <p style="margin-top:16px;">Please resolve the issue and mark the complaint as <strong>Done</strong> in the AEMS Maintenance module. Overdue reminders will continue twice daily at 9:00 AM and 4:00 PM IST until the complaint is closed.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}

export function buildComplaintSolvedEmail(c: MachineMailIdentity & {
  complaintText: string;
  remarks?: string;
  resolutionPhotoUrl?: string;
  reportedAt: string;
  resolvedAt: string;
  resolvedBy: string;
  reminderCount?: number;
}): { subject: string; html: string; text: string } {
  const subject = `Complaint Resolved — ${c.assetCode} (${c.machineNumber})`;
  const extra = [
    identityText(c),
    `Reported At: ${c.reportedAt}`,
    `Resolved At: ${c.resolvedAt}`,
    `Resolved By: ${c.resolvedBy}`,
    reminderText(c.reminderCount),
  ]
    .filter(Boolean)
    .join("\n");
  const text = `Dear Sir / Madam,

The downtime complaint below has been resolved and marked as Done.

${extra}

Complaint:
${c.complaintText}

Resolution remarks:
${c.remarks || "-"}

${c.resolutionPhotoUrl ? `Evidence photo: ${c.resolutionPhotoUrl}` : ""}

No further reminders will be issued for this complaint.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>The downtime complaint below has been resolved and marked as <strong>Done</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(c)}
      ${kvRow("Reported At", c.reportedAt)}
      ${kvRow("Resolved At", c.resolvedAt)}
      ${kvRow("Resolved By", c.resolvedBy)}
      ${reminderHtml(c.reminderCount)}
    </table>
    <p style="margin:0 0 8px;font-weight:700;">Complaint</p>
    <div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;">${escapeHtml(c.complaintText)}</div>
    ${c.remarks ? `<p style="margin:16px 0 8px;font-weight:700;">Resolution remarks</p><div style="padding:14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;white-space:pre-wrap;">${escapeHtml(c.remarks)}</div>` : ""}
    ${c.resolutionPhotoUrl ? `<p style="margin:16px 0 8px;font-weight:700;">Close-out evidence</p><p><a href="${escapeHtml(c.resolutionPhotoUrl)}">View evidence photo</a></p><p><img src="${escapeHtml(c.resolutionPhotoUrl)}" alt="Resolution evidence" style="max-width:100%;border-radius:10px;border:1px solid #e2e8f0;" /></p>` : ""}
    <p style="margin-top:16px;">No further reminders will be issued for this complaint.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}

export function buildTrendChangeEmail(m: MachineMailIdentity & {
  previousTrendMonths: number;
  newTrendMonths: number;
  nextMaintenanceDate: string;
  changedBy: string;
}): { subject: string; html: string; text: string } {
  const subject = `Maintenance Trend Updated — ${m.assetCode} (${m.machineNumber})`;
  const extra = [
    identityText(m),
    `Previous Trend: ${trendMonthsLabel(m.previousTrendMonths)}`,
    `New Trend: ${trendMonthsLabel(m.newTrendMonths)}`,
    `Updated Next Maintenance Date: ${m.nextMaintenanceDate}`,
    `Changed By: ${m.changedBy}`,
  ].join("\n");
  const text = `Dear Sir / Madam,

The preventive maintenance interval for the machine below has been updated.

${extra}

Future reminders will follow the revised schedule. Please review and ensure the new cycle is followed in the AEMS Maintenance module.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>The preventive maintenance interval for the machine below has been updated.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(m)}
      ${kvRow("Previous Trend", trendMonthsLabel(m.previousTrendMonths))}
      ${kvRow("New Trend", trendMonthsLabel(m.newTrendMonths), "color:#1d4ed8;")}
      ${kvRow("Next Maintenance Date", m.nextMaintenanceDate)}
      ${kvRow("Changed By", m.changedBy)}
    </table>
    <p>Future reminders will follow the revised schedule. Please review and ensure the new cycle is followed in the AEMS Maintenance module.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}

function todayKey(d = new Date()): string {
  return istTodayKey(d);
}

export { todayKey };

async function sendViaSmtp(to: string[], subject: string, html: string, text: string): Promise<void> {
  const user = getEnv("SMTP_EMAIL");
  const pass = getEnv("SMTP_PASSWORD");
  if (!user || !pass) {
    throw new Error("SMTP is not configured. Set SMTP_EMAIL and SMTP_PASSWORD.");
  }
  if (to.length === 0) throw new Error("No recipients");
  const transporter = nodemailer.createTransport({
    host: getEnv("SMTP_HOST") || "smtp.office365.com",
    port: parseInt(getEnv("SMTP_PORT") || "587", 10),
    secure: getEnv("SMTP_SECURE") === "true",
    auth: { user, pass },
  });
  const from = getEnv("OTP_FROM_EMAIL") || user;
  await transporter.sendMail({
    from: `"${APP_NAME}" <${from}>`,
    to: to.join(", "),
    subject,
    html,
    text,
  });
}

/** Send professional maintenance email via nodemailer (SMTP only — no Apps Script / GmailApp). */
export async function sendMaintenanceMail(opts: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; via?: string; error?: string }> {
  const recipients = Array.from(
    new Set(opts.to.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))
  );
  if (recipients.length === 0) return { ok: false, error: "No recipients" };

  try {
    await sendViaSmtp(recipients, opts.subject, opts.html, opts.text);
    return { ok: true, via: "smtp" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn("[MaintenanceMail] SMTP failed:", error);
    return { ok: false, error };
  }
}
