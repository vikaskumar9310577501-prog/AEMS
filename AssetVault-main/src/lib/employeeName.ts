import type { Employee } from '../types/employee';

export function normalizeEmployeeName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function findDuplicateEmployeeName(
  employees: Employee[],
  name: string,
  excludeEmployeeId?: string
): Employee | undefined {
  const key = normalizeEmployeeName(name);
  if (!key) return undefined;
  const exclude = String(excludeEmployeeId || '')
    .trim()
    .toUpperCase();
  return employees.find((e) => {
    if (normalizeEmployeeName(e.name) !== key) return false;
    if (exclude && String(e.employeeId || '').trim().toUpperCase() === exclude) return false;
    return true;
  });
}
