export type PlantLike = { code?: string; name?: string; location?: string };

/** Known short plant names when Settings name is missing or too long. */
export const PLANT_SHORT_NAMES: Record<string, string> = {
  '4020': 'NGM',
  '2040': 'PGTL',
};

function samePlant(a?: string, b?: string): boolean {
  const l = String(a || '').trim().toLowerCase();
  const r = String(b || '').trim().toLowerCase();
  if (!l || !r) return false;
  if (l === r) return true;
  if (l.includes(r) || r.includes(l)) return true;
  return false;
}

/** Plant name for UI. Full settings name; 4020→NGM / 2040→PGTL only if name is missing. */
export function plantShortName(code?: string | null, plants?: PlantLike[]): string {
  const c = String(code || '').trim();
  if (!c) return '—';

  const mapped = PLANT_SHORT_NAMES[c] || PLANT_SHORT_NAMES[c.toUpperCase()];
  const found = plants?.find((p) => samePlant(p.code, c) || samePlant(p.name, c));
  const name = String(found?.name || '').trim();

  if (name && !/^\d+$/.test(name)) return name;
  if (mapped) return mapped;
  if (found?.code && !/^\d+$/.test(String(found.code))) return String(found.code).trim();
  return c;
}

/** Short location tag for plant filter options (e.g. Bhiwadi / Supa). */
export function locationDisplayTag(location?: string | null): string {
  const loc = String(location || '').trim();
  if (!loc) return '';
  const lower = loc.toLowerCase();
  if (lower.includes('bhiwadi')) return 'Bhiwadi';
  if (lower.includes('supa')) return 'Supa';
  if (lower.includes('pune')) return 'Supa';
  return loc;
}

/** Short location tag for plant filter options (e.g. Bhiwadi / Supa). */
export function plantLocationTag(code?: string | null, plants?: PlantLike[]): string {
  const c = String(code || '').trim();
  if (!c) return '';
  const found = plants?.find((p) => samePlant(p.code, c) || samePlant(p.name, c));
  return locationDisplayTag(found?.location);
}

/** Plant name + location for filter dropdowns: "PG TECHNOPLAST · Bhiwadi". */
export function plantFilterLabel(code?: string | null, plants?: PlantLike[]): string {
  const name = plantShortName(code, plants);
  const place = plantLocationTag(code, plants);
  return place ? `${name} · ${place}` : name;
}

/** Short label for dense tables; full name on hover via title. */
export function plantTableLabel(code?: string | null, plants?: PlantLike[]): { short: string; full: string } {
  const full = plantShortName(code, plants);
  const c = String(code || '').trim();
  const mapped = PLANT_SHORT_NAMES[c] || PLANT_SHORT_NAMES[c.toUpperCase()];
  if (mapped) return { short: mapped, full };
  if (full.length <= 10) return { short: full, full };
  const words = full.split(/\s+/).filter(Boolean);
  const acronym = words.map((w) => w[0]).join('').toUpperCase();
  if (acronym.length >= 2 && acronym.length <= 8) return { short: acronym, full };
  return { short: `${full.slice(0, 9)}…`, full };
}
