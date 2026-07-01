export interface ScopedPlantRecord {
  code: string;
  name: string;
  location: string;
}

export interface ScopedUser {
  role?: string;
  locations?: string[];
  plants?: string[];
}

function norm(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function sameScopeOption(left: unknown, right: unknown): boolean {
  const l = norm(left);
  const r = norm(right);
  return !!l && !!r && l === r;
}

function scopeOptionIncludes(left: unknown, right: unknown): boolean {
  const l = norm(left);
  const r = norm(right);
  return !!l && !!r && (l === r || l.includes(r) || r.includes(l));
}

function cleanScopeList(values: string[] | undefined): string[] {
  return (values || []).map((value) => String(value || '').trim()).filter(Boolean);
}

function hasAllScope(values: string[] | undefined): boolean {
  return cleanScopeList(values).some((value) => sameScopeOption(value, 'All'));
}

function isItAdmin(user: ScopedUser | null | undefined): boolean {
  return sameScopeOption(user?.role, 'IT Admin');
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const clean = String(value || '').trim();
    if (!clean || sameScopeOption(clean, 'All')) continue;
    const key = norm(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }
  return next;
}

function plantKey(plant: ScopedPlantRecord): string {
  return norm(plant.code || plant.name);
}

function uniquePlants(plants: ScopedPlantRecord[]): ScopedPlantRecord[] {
  const seen = new Set<string>();
  const next: ScopedPlantRecord[] = [];
  for (const plant of plants) {
    const code = String(plant.code || plant.name || '').trim();
    const name = String(plant.name || plant.code || '').trim();
    if (!code && !name) continue;
    const normalized = plantKey({ code, name, location: plant.location || '' });
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    next.push({
      code,
      name,
      location: String(plant.location || '').trim(),
    });
  }
  return next;
}

function plantMatchesAllowedPlant(plant: ScopedPlantRecord, allowedPlant: string): boolean {
  return (
    scopeOptionIncludes(plant.code, allowedPlant) ||
    scopeOptionIncludes(plant.name, allowedPlant)
  );
}

function plantMatchesAllowedLocation(plant: ScopedPlantRecord, allowedLocation: string): boolean {
  return scopeOptionIncludes(plant.location, allowedLocation);
}

export function buildScopedLocationOptions(
  settingsLocations: string[],
  settingsPlants: ScopedPlantRecord[],
  user: ScopedUser | null | undefined,
  extraLocations: string[] = []
): string[] {
  const allowedLocations = cleanScopeList(user?.locations).filter(
    (value) => !sameScopeOption(value, 'All')
  );
  const allowedPlants = cleanScopeList(user?.plants).filter(
    (value) => !sameScopeOption(value, 'All')
  );
  const plantLocations = settingsPlants
    .filter((plant) =>
      allowedPlants.some((allowedPlant) => plantMatchesAllowedPlant(plant, allowedPlant))
    )
    .map((plant) => plant.location);
  const allLocations = uniqueValues([
    ...settingsLocations,
    ...extraLocations,
    ...allowedLocations,
    ...plantLocations,
  ]);

  if (!user || isItAdmin(user) || hasAllScope(user.locations) || allowedLocations.length === 0) {
    return allLocations;
  }

  return uniqueValues([
    ...allLocations.filter((location) =>
      allowedLocations.some((allowed) => scopeOptionIncludes(location, allowed))
    ),
    ...allowedLocations,
  ]);
}

export function buildScopedPlantOptions(
  settingsPlants: ScopedPlantRecord[],
  user: ScopedUser | null | undefined,
  extraPlants: ScopedPlantRecord[] = [],
  fallbackLocations: string[] = []
): ScopedPlantRecord[] {
  const allowedLocations = cleanScopeList(user?.locations).filter(
    (value) => !sameScopeOption(value, 'All')
  );
  const allowedPlants = cleanScopeList(user?.plants).filter(
    (value) => !sameScopeOption(value, 'All')
  );
  const allPlants = uniquePlants([...settingsPlants, ...extraPlants]);
  const locationScoped = (plant: ScopedPlantRecord) =>
    allowedLocations.length === 0 ||
    !plant.location ||
    allowedLocations.some((allowedLocation) => plantMatchesAllowedLocation(plant, allowedLocation));

  if (!user || isItAdmin(user) || hasAllScope(user.plants)) {
    return allPlants.filter(locationScoped);
  }

  if (allowedPlants.length === 0) {
    return allPlants.filter(locationScoped);
  }

  const scoped = allPlants.filter(
    (plant) =>
      locationScoped(plant) &&
      allowedPlants.some((allowedPlant) => plantMatchesAllowedPlant(plant, allowedPlant))
  );
  const fallbackLocation = fallbackLocations.find(Boolean) || allowedLocations[0] || '';
  const fallback = allowedPlants.map((plant) => ({
    code: plant,
    name: plant,
    location: fallbackLocation,
  }));

  return uniquePlants([...scoped, ...fallback]);
}
