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

/** Check if user has explicit HR access (via HR role, HR category, or IT Admin) */
export function canAccessHr(user: { role?: string; categories?: string[] } | null | undefined): boolean {
  if (!user) return false;
  if (isHrRole(user.role)) return true;
  if (isItAdminRole(user.role)) return true;
  const cats = user.categories || [];
  return cats.some((c) => {
    const lower = String(c || '').trim().toLowerCase();
    return lower === 'hr' || lower === 'hr operations' || lower === 'hr dashboard';
  });
}

export function assignableRoles(actorRole: string | undefined | null): string[] {
  if (isItAdminRole(actorRole)) return ['IT Admin', 'Admin', 'HR', 'User'];
  if (isAdminRole(actorRole)) return ['Admin', 'HR', 'User'];
  return [];
}

/** Prevention module scope — assign in User Management (separate from asset categories). */
export const PREVENTION_MODULE_CATEGORY = 'Prevention (PM)';

export function hasPreventionModuleCategory(categories: string[] | undefined): boolean {
  return (categories || []).some((c) => {
    const lower = String(c || '').trim().toLowerCase();
    return (
      lower === PREVENTION_MODULE_CATEGORY.toLowerCase() ||
      lower === 'prevention' ||
      lower === 'maintenance assets' ||
      lower === 'prevention (pm)'
    );
  });
}

/** IT Admin or user with explicitly assigned Prevention (PM) / Maintenance module access. */
export function canAccessMaintenance(
  role: string | undefined | null,
  categories?: string[]
): boolean {
  if (isItAdminRole(role)) return true;
  return hasPreventionModuleCategory(categories);
}

/** PM prevention dashboard — IT Admin or explicitly assigned Prevention users. */
export function canViewMaintenanceDashboard(
  role: string | undefined | null,
  categories?: string[]
): boolean {
  if (!canAccessMaintenance(role, categories)) return false;
  return isAdminRole(role) || isUserRole(role);
}

export function canViewMaintenanceMachines(
  role: string | undefined | null,
  categories?: string[]
): boolean {
  return canAccessMaintenance(role, categories);
}

export function canAddMaintenanceMachine(
  role: string | undefined | null,
  categories?: string[]
): boolean {
  if (!canAccessMaintenance(role, categories)) return false;
  return isAdminRole(role);
}

/** Complaint analytics dashboard — Admin + IT Admin with Prevention access. */
export function canViewMaintenanceComplaintDashboard(
  role: string | undefined | null,
  categories?: string[]
): boolean {
  if (!canAccessMaintenance(role, categories)) return false;
  return isAdminRole(role);
}

/** QR complaints inbox (Mark Done) — User + IT Admin with Prevention access. */
export function canViewMaintenanceComplaintsInbox(
  role: string | undefined | null,
  categories?: string[]
): boolean {
  if (!canAccessMaintenance(role, categories)) return false;
  return isItAdminRole(role) || isUserRole(role);
}

/** @deprecated use dashboard or inbox helpers */
export function canViewMaintenanceComplaints(
  role: string | undefined | null,
  categories?: string[]
): boolean {
  return canViewMaintenanceComplaintDashboard(role, categories) || canViewMaintenanceComplaintsInbox(role, categories);
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

export function defaultMaintenanceTab(
  role: string | undefined | null,
  categories?: string[]
): MaintenanceTabId {
  if (canViewMaintenanceDashboard(role, categories)) return 'dashboard';
  if (canViewMaintenanceComplaintsInbox(role, categories)) return 'complaints';
  return 'machines';
}

export function canAccessMaintenanceTab(
  role: string | undefined | null,
  tab: MaintenanceTabId,
  categories?: string[]
): boolean {
  if (tab === 'dashboard') return canViewMaintenanceDashboard(role, categories);
  if (tab === 'machines') return canViewMaintenanceMachines(role, categories);
  if (tab === 'complaint-dashboard') return canViewMaintenanceComplaintDashboard(role, categories);
  if (tab === 'complaints') return canViewMaintenanceComplaintsInbox(role, categories);
  if (tab === 'settings') return canManageMaintenanceFhPh(role);
  return false;
}
