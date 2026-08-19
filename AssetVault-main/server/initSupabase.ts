import { getSupabaseUrl, isSupabaseMode } from "./sqlConfig.js";
import { ensureStorageBucket } from "./supabaseClient.js";

export async function initSupabase(): Promise<void> {
  if (!isSupabaseMode()) return;
  console.log("[Supabase] Connecting", getSupabaseUrl());
  await ensureStorageBucket();
  console.log("[Supabase] Storage ready");
}
