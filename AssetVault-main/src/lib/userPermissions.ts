const IT_ADMIN_ROLES = new Set(['IT Admin', 'IT_ADMIN', 'it admin']);
const ADMIN_ROLES = new Set(['Admin', 'admin', ...IT_ADMIN_ROLES]);

export function isItAdminRole(role: string | undefined | null): boolean {
  return !!role && IT_ADMIN_ROLES.has(role);
}

export function isAdminRole(role: string | undefined | null): boolean {
  return !!role && ADMIN_ROLES.has(role);
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
  return role === 'HR';
}

export function assignableRoles(actorRole: string | undefined | null): string[] {
  if (isItAdminRole(actorRole)) return ['IT Admin', 'Admin', 'HR', 'User'];
  if (isAdminRole(actorRole)) return ['Admin', 'HR', 'User'];
  return [];
}
