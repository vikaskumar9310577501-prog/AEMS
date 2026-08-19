export function cleanEnvValue(value: string | undefined): string {
  const trimmed = String(value || "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function getEnv(name: string): string {
  return cleanEnvValue(process.env[name]);
}

export function setCleanEnv(name: string): string {
  const clean = getEnv(name);
  if (clean) process.env[name] = clean;
  return clean;
}

export function resolveEnv(names: string[]): { name: string; value: string } {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return { name, value };
  }
  return { name: names[0] || "", value: "" };
}

export function setCleanEnvAlias(
  canonicalName: string,
  aliases: string[] = []
): { name: string; value: string } {
  const resolved = resolveEnv([canonicalName, ...aliases]);
  if (resolved.value) process.env[canonicalName] = resolved.value;
  return resolved;
}

export function maskValue(value: string, visible = 8): string {
  if (!value) return "";
  if (value.length <= visible * 2) return `${value.slice(0, 3)}...`;
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}
