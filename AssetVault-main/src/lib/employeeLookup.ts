export function normalizeEmployeeId(id: string): string {
  return String(id || '').trim().toUpperCase();
}
