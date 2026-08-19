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

/** Maintenance module — IT Admin only. */
export function canAccessMaintenance(role: string | undefined | null): boolean {
  return isItAdminRole(role);
}

/** User: machines + PM plan. Admin: dashboard + machines + complaints. IT Admin: all. */
export function canViewMaintenanceDashboard(role: string | undefined | null): boolean {
  return canAccessMaintenance(role);
}

export function canViewMaintenanceMachines(role: string | undefined | null): boolean {
  return canAccessMaintenance(role);
}

export function canAddMaintenanceMachine(role: string | undefined | null): boolean {
  return canAccessMaintenance(role);
}

export function canViewMaintenanceComplaints(role: string | undefined | null): boolean {
  return isAdminRole(role);
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
  return 'machines';
}

export function canAccessMaintenanceTab(
  role: string | undefined | null,
  tab: MaintenanceTabId
): boolean {
  if (tab === 'dashboard') return canViewMaintenanceDashboard(role);
  if (tab === 'machines') return canViewMaintenanceMachines(role);
  if (tab === 'complaint-dashboard') return canViewMaintenanceComplaints(role);
  if (tab === 'complaints') return canViewMaintenanceComplaints(role);
  if (tab === 'settings') return canManageMaintenanceFhPh(role);
  return false;
}
