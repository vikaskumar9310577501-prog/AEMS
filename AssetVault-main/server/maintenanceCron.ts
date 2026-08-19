import {
  listMaintenanceMachines,
  listMaintenanceComplaints,
  upsertMaintenanceMachine,
  upsertMaintenanceComplaint,
  getMaintenanceMeta,
} from "./maintenanceStore.js";
import {
  buildPreventiveReminderEmail,
  buildPreventiveOverdueEmail,
  buildComplaintPendingEmail,
  buildComplaintOverOneWeekEmail,
  sendMaintenanceMail,
  getPlantMaintenanceEmails,
  pickMailIdentity,
  todayKey,
} from "./maintenanceMail.js";
import {
  daysUntilDateIst,
  istCalendarDaysSince,
  istMailSlotKey,
  COMPLAINT_RESOLVE_SLA_DAYS,
} from "../src/lib/maintenanceCodes.js";
import type { MaintenanceComplaint, MaintenanceMachine } from "../src/types/maintenance.js";

export { getPlantMaintenanceEmails };

export type MaintenanceCronResult = {
  ok: boolean;
  date: string;
  slot: string | null;
  monthRemindersSent: number;
  remindersSent: number;
  overdueSent: number;
  complaintDailySent: number;
  complaintOverdueSent: number;
  errors: string[];
};

function alreadySentSlot(lastMailSlot: string | undefined, slotKey: string | null, date: string, lastDaily?: string): boolean {
  if (slotKey) return lastMailSlot === slotKey;
  return lastDaily === date;
}

function alreadySentToday(lastDaily: string | undefined, date: string): boolean {
  return lastDaily === date;
}

/** 7-day window: one mail per day. Overdue / open complaint overdue: 9 AM and 4 PM IST. */
export async function runMaintenanceCron(): Promise<MaintenanceCronResult> {
  const date = todayKey();
  const slotKey = istMailSlotKey();
  const result: MaintenanceCronResult = {
    ok: true,
    date,
    slot: slotKey,
    monthRemindersSent: 0,
    remindersSent: 0,
    overdueSent: 0,
    complaintDailySent: 0,
    complaintOverdueSent: 0,
    errors: [],
  };

  const meta = await getMaintenanceMeta();
  const plantContacts = meta.plantContacts || {};
  const machines = await listMaintenanceMachines();

  for (const machine of machines) {
    if (machine.status === "Done") continue;
    const days = daysUntilDateIst(machine.nextMaintenanceDate);
    if (days == null) continue;
    const recipients = getPlantMaintenanceEmails(plantContacts, machine.plantCode);
    if (recipients.length === 0) continue;

    const identity = pickMailIdentity(machine);
    const nextCount = (machine.reminderCount || 0) + 1;

    const recordSent = async (patch: Partial<MaintenanceMachine>) => {
      await upsertMaintenanceMachine({
        ...machine,
        ...patch,
        reminderCount: nextCount,
        lastMailSlot: slotKey || `${date}-am`,
        lastReminderEmailOn: date,
        updatedAt: new Date().toISOString(),
      });
    };

    // 7 days before the due date through the due date: one professional reminder per day
    if (days >= 0 && days <= 7) {
      if (alreadySentToday(machine.lastReminderEmailOn, date)) continue;
      const mail = buildPreventiveReminderEmail({
        ...identity,
        nextMaintenanceDate: machine.nextMaintenanceDate,
        reminderCount: nextCount,
        daysRemaining: days,
      });
      const sent = await sendMaintenanceMail({ to: recipients, ...mail });
      if (sent.ok) {
        result.remindersSent += 1;
        await recordSent({
          status: days === 0 ? "Maintenance Due" : machine.status === "Active" ? "Maintenance Due" : machine.status,
        });
      } else if (sent.error) {
        result.errors.push(`${machine.assetCode} reminder: ${sent.error}`);
      }
      continue;
    }

    // After the due date: overdue reminders twice daily (9:00 AM and 4:00 PM IST) with reminder count
    if (days < 0) {
      if (alreadySentSlot(machine.lastMailSlot, slotKey, date, machine.lastDailyEmailOn)) continue;
      const mail = buildPreventiveOverdueEmail({
        ...identity,
        nextMaintenanceDate: machine.nextMaintenanceDate,
        pendingDays: Math.abs(days),
        reminderCount: nextCount,
      });
      const sent = await sendMaintenanceMail({ to: recipients, ...mail });
      if (sent.ok) {
        result.overdueSent += 1;
        await recordSent({
          lastDailyEmailOn: date,
          lastEscalationEmailOn: date,
          status: "Overdue",
        });
      } else if (sent.error) {
        result.errors.push(`${machine.assetCode} overdue: ${sent.error}`);
      }
    }
  }

  const complaints = await listMaintenanceComplaints();
  for (const complaint of complaints) {
    if (complaint.status !== "Open") continue;
    const recipients = getPlantMaintenanceEmails(plantContacts, complaint.plantCode);
    if (recipients.length === 0) continue;

    const pendingDays = istCalendarDaysSince(complaint.reportedAt);
    if (pendingDays < 1) continue;

    const identity = pickMailIdentity(complaint);
    const nextCount = (complaint.reminderCount || 0) + 1;
    const overdue = pendingDays > COMPLAINT_RESOLVE_SLA_DAYS;

    if (overdue) {
      if (alreadySentSlot(complaint.lastMailSlot, slotKey, date, complaint.lastDailyEmailOn)) continue;
    } else if (alreadySentToday(complaint.lastDailyEmailOn, date)) {
      continue;
    }

    const useOverdueTemplate = overdue && !complaint.notifiedOverdueOn;
    const mail = useOverdueTemplate
      ? buildComplaintOverOneWeekEmail({
          ...identity,
          complaintText: complaint.complaintText,
          reportedAt: complaint.reportedAt,
          pendingDays,
          reminderCount: nextCount,
        })
      : buildComplaintPendingEmail({
          ...identity,
          complaintText: complaint.complaintText,
          pendingDays,
          reminderCount: nextCount,
        });
    const sent = await sendMaintenanceMail({ to: recipients, ...mail });
    if (sent.ok) {
      if (overdue) result.complaintOverdueSent += 1;
      else result.complaintDailySent += 1;
      const patch: MaintenanceComplaint = {
        ...complaint,
        reminderCount: nextCount,
        lastDailyEmailOn: date,
        lastMailSlot: slotKey || `${date}-am`,
        notifiedOverdueOn: useOverdueTemplate ? date : complaint.notifiedOverdueOn,
      };
      await upsertMaintenanceComplaint(patch);
    } else if (sent.error) {
      result.errors.push(`complaint ${complaint.id}: ${sent.error}`);
    }
  }

  result.ok = result.errors.length === 0;
  return result;
}
