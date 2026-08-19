/** True when employee must not receive new asset assignments (return-only). */
export function isInactiveEmployee(status: string | undefined): boolean {
  const normalized = (status || '').trim().toLowerCase();
  return normalized === 'inactive' || normalized === 'deactive' || normalized === 'deactivated';
}

export function employeeStatusLabel(status: string | undefined): 'Active' | 'Inactive' {
  return isInactiveEmployee(status) ? 'Inactive' : 'Active';
}
