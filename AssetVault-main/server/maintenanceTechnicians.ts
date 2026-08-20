export const MAX_MAINTENANCE_TECHNICIANS = 20;

export function normalizeTechnicianNames(names: unknown): string[] {
  if (!Array.isArray(names)) return [];
  return names.map((n) => String(n || "").trim()).filter(Boolean);
}

export function parseTechnicianPayload(body: {
  technicianCount?: unknown;
  technicianNames?: unknown;
}): { technicianCount: number; technicianNames: string[] } | { error: string } {
  const technicianCount = Math.floor(Number(body.technicianCount));
  const technicianNames = normalizeTechnicianNames(body.technicianNames);

  if (!Number.isFinite(technicianCount) || technicianCount < 1) {
    return { error: "Select how many people worked on this job (minimum 1)" };
  }
  if (technicianCount > MAX_MAINTENANCE_TECHNICIANS) {
    return { error: `Maximum ${MAX_MAINTENANCE_TECHNICIANS} people allowed` };
  }
  if (technicianNames.length !== technicianCount) {
    return {
      error: `Enter all ${technicianCount} name${technicianCount === 1 ? "" : "s"}`,
    };
  }

  const seen = new Set<string>();
  for (const name of technicianNames) {
    if (name.length < 2) {
      return { error: "Each name must be at least 2 characters" };
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return { error: "Duplicate names are not allowed" };
    }
    seen.add(key);
  }

  return { technicianCount, technicianNames };
}

export function formatTechnicianNames(names?: string[]): string {
  const list = normalizeTechnicianNames(names);
  return list.length ? list.join(", ") : "-";
}
