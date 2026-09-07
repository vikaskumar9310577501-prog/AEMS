export type EmailTriggerType =
  | 'overdue_pm'
  | 'upcoming_pm'
  | 'monthly_pm'
  | 'complaint_created'
  | 'complaint_assigned'
  | 'complaint_accepted'
  | 'complaint_started'
  | 'complaint_pending'
  | 'complaint_resolved'
  | 'complaint_closed'
  | 'complaint_reopened'
  | 'sla_breached'
  | 'custom_scheduled';

export type EmailFrequency = 'instant' | 'daily' | 'weekly' | 'monthly' | 'one_time';

export type RecipientTarget = 'to' | 'cc' | 'bcc';

export type RecipientRuleType = 'role' | 'user' | 'plant_contacts' | 'manual_email' | 'department_head';

export interface RecipientRule {
  type: RecipientRuleType;
  value: string; // e.g. "Plant Head", "maint.mgr@pgel.in", "all_authorized"
  target: RecipientTarget;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: EmailTriggerType | 'general';
  subject: string;
  bodyHtml: string;
  variables: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface EmailAutomation {
  id: string;
  name: string;
  triggerType: EmailTriggerType;
  status: 'active' | 'inactive' | 'paused';
  frequency: EmailFrequency;
  scheduleTimes: string[]; // e.g. ["09:00", "16:00"] for multiple runs per day
  reminderDays?: number; // e.g. 7 (days before PM)
  locationScope?: string[]; // empty means all authorized
  plantScope?: string[]; // empty means all authorized
  departmentScope?: string[];
  recipientRules: RecipientRule[];
  templateId: string;
  consolidationMode: 'consolidated' | 'individual';
  retryCount: number; // default 3
  retryIntervalMinutes: number; // default 15
  failureNotificationEmail?: string;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDraft {
  id: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyHtml: string;
  location?: string;
  plantCode?: string;
  department?: string;
  templateId?: string;
  scheduleConfig?: {
    frequency: EmailFrequency;
    scheduleTime: string;
    startDate?: string;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailExecutionLog {
  id: string;
  automationId?: string;
  automationName?: string;
  triggerType: EmailTriggerType | 'manual';
  idempotencyKey?: string;
  date: string;
  time: string;
  sender: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  location?: string;
  plantCode?: string;
  department?: string;
  status: 'sent' | 'failed' | 'retrying';
  sentAt?: string;
  failureReason?: string;
  retryCount: number;
  machineCount?: number;
}

export interface EmailAnalytics {
  totalEmails: number;
  sent: number;
  failed: number;
  retrying: number;
  scheduledAutomations: number;
  drafts: number;
  byCategory: Record<string, number>;
  trend: Array<{ date: string; sent: number; failed: number }>;
}
