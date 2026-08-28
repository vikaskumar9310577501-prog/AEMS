import "dotenv/config";
import fs from "fs";
import path from "path";
import { isSupabaseMode, isSqlMode, isDbMode } from "../server/sqlConfig.js";
import { deleteJsonRow, getJsonRow, listJsonRows } from "../server/sqlStore.js";
import type { MappedAsset } from "../server/assetHelpers.js";

const DEMO_MARKER = "AEMS-DEMO-BHIWADI-2026";
const MANIFEST_PATH = path.join(process.cwd(), "data", "demo_data_manifest.json");

async function run() {
  console.log("=== AEMS SAFE DEMO DATA CLEANUP ===");
  console.log(`Target Demo Marker: ${DEMO_MARKER}`);

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`ERROR: Manifest file not found at ${MANIFEST_PATH}.`);
    console.error("Cleanup aborted to protect real data.");
    process.exit(1);
  }

  const manifestRaw = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const manifest = JSON.parse(manifestRaw);

  if (manifest.demoMarker !== DEMO_MARKER) {
    console.error(`ERROR: Manifest marker mismatch (${manifest.demoMarker} !== ${DEMO_MARKER}). Aborting.`);
    process.exit(1);
  }

  const demoRecords: Array<{ id: string; marker: string }> = manifest.records || [];
  console.log(`Manifest contains ${demoRecords.length} demo records to remove.`);

  const currentAssets = await listJsonRows<MappedAsset>("Assets");
  console.log(`Pre-cleanup total assets in DB: ${currentAssets.length}`);

  let removedCount = 0;
  let skippedCount = 0;

  for (const record of demoRecords) {
    const id = record.id;
    const existing = await getJsonRow<MappedAsset>("Assets", id);

    if (!existing) {
      console.log(`[SKIP] Record not found (already deleted): ${id}`);
      skippedCount++;
      continue;
    }

    // STRICT SAFETY CHECK: Verify that the record contains the DEMO_MARKER
    const isDemo =
      existing.createdBy === DEMO_MARKER ||
      (existing.uniqueCode && existing.uniqueCode.startsWith("AEMS-DEMO-BHIWADI-")) ||
      (existing.qrCodeText && existing.qrCodeText.includes(DEMO_MARKER));

    if (!isDemo) {
      console.error(`CRITICAL SAFETY ABORT: Record ${id} is NOT marked as demo! Aborting cleanup immediately.`);
      process.exit(1);
    }

    // SAFETY CHECK: Ensure it is not an IT asset or Employee asset
    if (
      existing.mainCategory === "IT Assets" ||
      existing.mainCategory === "Software / License Assets" ||
      existing.employeeId
    ) {
      console.error(`CRITICAL SAFETY ABORT: Record ${id} is a protected IT/Employee asset! Aborting cleanup immediately.`);
      process.exit(1);
    }

    await deleteJsonRow("Assets", id);
    console.log(`[REMOVED] ${id} (${existing.assetName || existing.make})`);
    removedCount++;
  }

  // Remove manifest file after cleanup
  fs.unlinkSync(MANIFEST_PATH);
  console.log(`Manifest file removed: ${MANIFEST_PATH}`);

  const postAssets = await listJsonRows<MappedAsset>("Assets");
  console.log(`\nPost-cleanup total assets in DB: ${postAssets.length}`);
  console.log(`Total removed: ${removedCount}, Skipped: ${skippedCount}`);
  console.log("\n=== AEMS DEMO DATA CLEANUP COMPLETED SAFELY ===");
}

run().catch((err) => {
  console.error("FATAL ERROR during demo data cleanup:", err);
  process.exit(1);
});
