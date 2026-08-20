const IT_ADMIN_ROLES = new Set(['it admin', 'it_admin']);
const ADMIN_ROLES = new Set(['admin', ...IT_ADMIN_ROLES]);

function normalizeRole(role: string | undefined | null): string {
  return String(role || '').trim().toLowerCase();
}

export function isItAdminRole(role: string | undefined | null): boolean {
  return IT_ADMIN_ROLES.has(normalizeRole(role));
}

export function isAdminRole(role: string | undefined | null): boolean {
  return ADMIN_ROLES.has(normalizeRole(role));
}

export function isUserRole(role: string | undefined | null): boolean {
  return normalizeRole(role) === 'user';
}

export function canAccessUserManagement(role: string | undefined | null): boolean {
  return isAdminRole(role);
}

export function isProtectedItAdminUser(user: { role: string }): boolean {
  return isItAdminRole(user.role);
}

export function canAddUser(actorRole: string | undefined | null): boolean {
  return isAdminRole(actorRole);
}

export function canEditUser(actorRole: string | undefined | null): boolean {
  return isItAdminRole(actorRole);
}

export function canDeleteUser(
  actorRole: string | undefined | null,
  target: { role: string }
): boolean {
  return isAdminRole(actorRole) && !isProtectedItAdminUser(target);
}

export function isHrRole(role: string | undefined | null): boolean {
  return normalizeRole(role) === 'hr';
}

export function assignableRoles(actorRole: string | undefined | null): string[] {
  if (isItAdminRole(actorRole)) return ['IT Admin', 'Admin', 'HR', 'User'];
  if (isAdminRole(actorRole)) return ['Admin', 'HR', 'User'];
  return [];
}

/** Prevention module scope — assign in User Management (separate from asset categories). */
export const PREVENTION_MODULE_CATEGORY = 'Prevention (PM)';

export function hasPreventionModuleCategory(categories: string[] | undefined): boolean {
  return (categories || []).some(
    (c) => String(c || '').trim().toLowerCase() === PREVENTION_MODULE_CATEGORY.toLowerCase()
  );
}

/** IT Admin, Admin, or User with Prevention (PM) category (User role always allowed). */
export function canAccessMaintenance(
  role: string | undefined | null,
  categories?: string[]
): boolean {
  if (isItAdminRole(role) || isAdminRole(role)) return true;
  if (isUserRole(role)) return true;
  return hasPreventionModuleCategory(categories);
}

/** PM prevention dashboard — Admin, IT Admin, and User. */
export function canViewMaintenanceDashboard(role: string | undefined | null): boolean {
  return isAdminRole(role) || isUserRole(role);
}

export function canViewMaintenanceMachines(role: string | undefined | null): boolean {
  return canAccessMaintenance(role);
}

export function canAddMaintenanceMachine(role: string | undefined | null): boolean {
  return isAdminRole(role);
}

/** Complaint analytics dashboard — Admin + IT Admin. */
export function canViewMaintenanceComplaintDashboard(role: string | undefined | null): boolean {
  return isAdminRole(role);
}

/** QR complaints inbox (Mark Done) — User + IT Admin. Admin uses analytics dashboard. */
export function canViewMaintenanceComplaintsInbox(role: string | undefined | null): boolean {
  return isItAdminRole(role) || isUserRole(role);
}

/** @deprecated use dashboard or inbox helpers */
export function canViewMaintenanceComplaints(role: string | undefined | null): boolean {
  return canViewMaintenanceComplaintDashboard(role) || canViewMaintenanceComplaintsInbox(role);
}

/** FH / PH plant contact settings — IT Admin only. */
export function canManageMaintenanceFhPh(role: string | undefined | null): boolean {
  return isItAdminRole(role);
}

export type MaintenanceTabId =
  | 'dashboard'
  | 'machines'
  | 'complaint-dashboard'
  | 'complaints'
  | 'settings';

export function defaultMaintenanceTab(role: string | undefined | null): MaintenanceTabId {
  if (canViewMaintenanceDashboard(role)) return 'dashboard';
  if (canViewMaintenanceComplaintsInbox(role)) return 'complaints';
  return 'machines';
}

export function canAccessMaintenanceTab(
  role: string | undefined | null,
  tab: MaintenanceTabId
): boolean {
  if (tab === 'dashboard') return canViewMaintenanceDashboard(role);
  if (tab === 'machines') return canViewMaintenanceMachines(role);
  if (tab === 'complaint-dashboard') return canViewMaintenanceComplaintDashboard(role);
  if (tab === 'complaints') return canViewMaintenanceComplaintsInbox(role);
  if (tab === 'settings') return canManageMaintenanceFhPh(role);
  return false;
}
