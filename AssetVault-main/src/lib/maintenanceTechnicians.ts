export type MaintenanceTechnicianPayload = {
  technicianCount: number;
  technicianNames: string[];
};

export const MAX_MAINTENANCE_TECHNICIANS = 20;

export function normalizeTechnicianNames(names: string[]): string[] {
  return names.map((n) => n.trim()).filter(Boolean);
}

export function buildTechnicianNameSlots(count: number, existing: string[] = []): string[] {
  const safe = Math.max(1, Math.min(MAX_MAINTENANCE_TECHNICIANS, Math.floor(count) || 1));
  return Array.from({ length: safe }, (_, i) => existing[i] || '');
}

export function validateTechnicians(count: number, names: string[]): string | null {
  const safe = Math.floor(Number(count));
  if (!Number.isFinite(safe) || safe < 1) {
    return 'Select how many people worked on this job (minimum 1)';
  }
  if (safe > MAX_MAINTENANCE_TECHNICIANS) {
    return `Maximum ${MAX_MAINTENANCE_TECHNICIANS} people allowed`;
  }
  const filled = normalizeTechnicianNames(names);
  if (filled.length !== safe) {
    return `Enter all ${safe} name${safe === 1 ? '' : 's'}`;
  }
  const seen = new Set<string>();
  for (const name of filled) {
    if (name.length < 2) return 'Each name must be at least 2 characters';
    const key = name.toLowerCase();
    if (seen.has(key)) return 'Duplicate names are not allowed';
    seen.add(key);
  }
  return null;
}

export function formatTechnicianNames(names?: string[]): string {
  const list = normalizeTechnicianNames(names || []);
  return list.length ? list.join(', ') : '—';
}
