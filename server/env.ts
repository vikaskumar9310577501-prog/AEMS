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

export function maskValue(value: string, visible = 8): string {
  if (!value) return "";
  if (value.length <= visible * 2) return `${value.slice(0, 3)}...`;
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}
