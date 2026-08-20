/** Production / plant machines for Preventive + Downtime Maintenance module. */

export type MaintenanceMachineStatus =
  | 'Active'
  | 'Maintenance Due'
  | 'Overdue'
  | 'Done'
  | 'Down';

export type MaintenanceComplaintStatus = 'Open' | 'Resolved';

export interface MaintenancePmLog {
  plannedDate?: string;
  doneOn: string;
  /** Number of technicians who performed this PM. */
  technicianCount?: number;
  /** Names of technicians who performed this PM. */
  technicianNames?: string[];
  /** Logged-in user who marked Done. */
  doneBy?: string;
}

/** 0 = Custom — dashboard uses only manually entered dates (no auto interval). */
export const CUSTOM_TREND_MONTHS = 0;

/** Allowed preventive maintenance interval (months) per machine. */
export const TREND_MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 12] as const;
export type TrendMonths = (typeof TREND_MONTH_OPTIONS)[number];
export const DEFAULT_TREND_MONTHS: TrendMonths = 2;
export const TREND_SELECT_OPTIONS = [CUSTOM_TREND_MONTHS, ...TREND_MONTH_OPTIONS] as const;

export function isCustomTrend(months?: number): boolean {
  return Number(months) === CUSTOM_TREND_MONTHS;
}

export function trendMonthsLabel(months: number): string {
  switch (months) {
    case CUSTOM_TREND_MONTHS:
      return 'Custom (manual dates)';
    case 1:
      return 'Monthly (1 month)';
    case 2:
      return 'Every 2 months';
    case 3:
      return 'Quarterly (3 months)';
    case 4:
      return 'Every 4 months';
    case 5:
      return 'Every 5 months';
    case 6:
      return 'Half-yearly (6 months)';
    case 12:
      return 'Yearly (12 months)';
    default:
      return `Every ${months} months`;
  }
}

export interface MaintenanceMachine {
  id: string;
  machineType: string;
  machineNumber: string;
  assetCode: string;
  /** Descriptive equipment / asset name */
  equipmentName?: string;
  department?: string;
  responsibility?: string;
  location: string;
  plantCode: string;
  /** Preventive cycle in months. 0 = Custom (manual dates only). */
  trendMonths?: number;
  /** Extra planned dates when trend is Custom — shown on the dashboard as-is. */
  customPlanDates?: string[];
  nextMaintenanceDate: string;
  lastMaintenanceDate?: string;
  status: MaintenanceMachineStatus;
  remarks?: string;
  /** ISO date (yyyy-mm-dd) of last preventive reminder email */
  lastReminderEmailOn?: string;
  /** ISO date of last FH/PH escalation */
  lastEscalationEmailOn?: string;
  /** ISO date of last daily overdue mail */
  lastDailyEmailOn?: string;
  /** Last IST mail slot sent, e.g. 2026-08-18-am or 2026-08-18-pm */
  lastMailSlot?: string;
  /** Reminder emails sent for the current open PM cycle */
  reminderCount?: number;
  /** Completed PM cycles for Plan vs Actual calendar. */
  pmLogs?: MaintenancePmLog[];
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface MaintenanceComplaint {
  id: string;
  machineId: string;
  assetCode: string;
  machineType: string;
  machineNumber: string;
  equipmentName?: string;
  department?: string;
  responsibility?: string;
  location: string;
  plantCode: string;
  complaintText: string;
  /** Shop-floor reporter remark (required on QR form). Separate from resolution remarks. */
  remark?: string;
  /** Total reported downtime in minutes. */
  downtimeMinutes?: number;
  photoUrl?: string;
  photoName?: string;
  status: MaintenanceComplaintStatus;
  remarks?: string;
  /** Close-out evidence photo after Mark Done. */
  resolutionPhotoUrl?: string;
  resolutionPhotoName?: string;
  reportedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  /** Number of people who resolved this breakdown complaint. */
  resolvedTechnicianCount?: number;
  /** Names of people who resolved this breakdown complaint. */
  resolvedTechnicianNames?: string[];
  lastDailyEmailOn?: string;
  /** Last IST mail slot sent, e.g. 2026-08-18-am or 2026-08-18-pm */
  lastMailSlot?: string;
  /** Reminder emails sent while this complaint stays open */
  reminderCount?: number;
  notifiedFhOn?: string;
  /** ISO date when >1-week overdue escalation was sent */
  notifiedOverdueOn?: string;
}

export interface MaintenancePlantContact {
  hodEmail?: string;
  fhEmail?: string;
  phEmail?: string;
}

export interface MaintenanceMeta {
  machineTypes: string[];
  /** plantCode → { hodEmail, fhEmail, phEmail } */
  plantContacts?: Record<string, MaintenancePlantContact>;
  updatedAt?: string;
}

export const DEFAULT_MACHINE_TYPES = [
  'Injection Molding Machine',
  'CNC Machine',
  'Press Machine',
  'Compressor',
  'Generator',
  'Conveyor',
  'Packaging Machine',
  'Extruder',
  'Chiller',
  'Boiler',
] as const;

export function emptyMaintenanceMachine(): Omit<MaintenanceMachine, 'id' | 'assetCode'> {
  return {
    machineType: '',
    machineNumber: '',
    equipmentName: '',
    department: '',
    responsibility: '',
    location: '',
    plantCode: '',
    trendMonths: DEFAULT_TREND_MONTHS,
    nextMaintenanceDate: '',
    status: 'Active',
    remarks: '',
  };
}
