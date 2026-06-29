import type { AppSettings, PlantRecord } from "./dataStore.js";

import { gasGetUrl } from "./gasClient.js";

type GasProxy = (payload: Record<string, unknown>, timeoutMs?: number) => Promise<unknown>;

function gasError(result: unknown): string | null {
  if (!result || typeof result !== "object") return "Invalid response from Database";
  const r = result as Record<string, unknown>;
  if (r.error) return String(r.error);
  if (r.success === false) return String(r.message || r.error || "Sync failed");
  return null;
}

export async function fetchLocationsPlantsFromGas(
  proxyToGas: GasProxy,
  gasWebappUrl?: string
): Promise<{ locations: string[]; plants: PlantRecord[] } | null> {
  try {
    let result = await proxyToGas({ action: "list_locations_plants" }, 30000);
    const err = gasError(result);
    if (err) {
      if (!gasWebappUrl) {
        console.warn("list_locations_plants:", err);
        return null;
      }
      const url = gasGetUrl(gasWebappUrl, { action: "list_locations_plants" });
      const response = await fetch(url);
      const text = await response.text();
      result = JSON.parse(text);
      const getErr = gasError(result);
      if (getErr) {
        console.warn("list_locations_plants:", getErr);
        return null;
      }
    }
    const r = result as { locations?: string[]; plants?: PlantRecord[] };
    const locations = Array.isArray(r.locations)
      ? r.locations.map((l) => String(l).trim()).filter(Boolean)
      : [];
    const plants = Array.isArray(r.plants)
      ? r.plants
          .map((p) => ({
            code: String((p as PlantRecord).code || "").trim(),
            name: String((p as PlantRecord).name || "").trim(),
            location: String((p as PlantRecord).location || "").trim(),
          }))
          .filter((p) => p.code)
      : [];
    return { locations, plants };
  } catch (e) {
    console.warn("fetchLocationsPlantsFromGas failed:", e);
    return null;
  }
}

export async function persistLocationsPlantsToGas(
  settings: Pick<AppSettings, "locations" | "plants">,
  proxyToGas: GasProxy
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await proxyToGas(
      {
        action: "sync_locations_plants",
        locations: settings.locations || [],
        plants: settings.plants || [],
      },
      45000
    );
    const err = gasError(result);
    if (err) return { ok: false, error: err };
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Database sync failed";
    return { ok: false, error: msg };
  }
}
