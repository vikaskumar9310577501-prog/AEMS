import type { AppUser } from "./dataStore.js";

function formatList(value: string[] | string | undefined): string {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "");
}

export function buildGasUserPayloads(
  action: "add_user" | "update_user" | "delete_user",
  user: AppUser,
  email?: string
): Record<string, unknown>[] {
  const flat = {
    email: user.email,
    role: user.role,
    locations: formatList(user.locations),
    plants: formatList(user.plants),
    categories: formatList(user.categories),
  };

  if (action === "delete_user") {
    const target = email || user.email;
    return [
      { action: "delete_user", email: target },
      { action: "deleteUser", email: target },
      { action: "remove_user", email: target },
    ];
  }

  if (action === "update_user") {
    return [
      { action: "update_user", user },
      { action: "update_user", ...flat },
      { action: "updateUser", user: flat },
      { action: "edit_user", user: flat },
    ];
  }

  return [
    { action: "add_user", user },
    { action: "add_user", ...flat },
    { action: "addUser", user: flat },
  ];
}

export function isGasSuccess(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as Record<string, unknown>;
  if (r.error) return false;
  return r.success === true || r.ok === true || !!r.user || !!r.users;
}

export async function saveUserViaGas(
  proxyToGas: (payload: Record<string, unknown>, timeoutMs?: number) => Promise<unknown>,
  action: "add_user" | "update_user" | "delete_user",
  user: AppUser,
  email?: string
): Promise<{ ok: boolean; error?: string }> {
  const payloads = buildGasUserPayloads(action, user, email);
  const errors: string[] = [];

  for (const payload of payloads) {
    try {
      const result = await proxyToGas(payload, 25000);
      if (isGasSuccess(result)) {
        return { ok: true };
      }
      const err = (result as { error?: string })?.error;
      if (err) errors.push(String(err));
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : "GAS request failed");
    }
  }

  return {
    ok: false,
    error: errors[0] || `Google Apps Script does not support ${action}. Update GAS or add service account.`,
  };
}
