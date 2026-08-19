import type { Database } from "sqlite";
import path from "path";
import fs from "fs";
import { CATEGORY_HEADERS, IT_EXTRA_HEADERS } from "./sheetHeaders.js";

// Constants for category headers — must match gas/WebApp.gs + server/sheetHeaders.ts
const CATEGORIES = [
  "IT Assets",
  "Office Assets",
  "Electrical Assets",
  "Production Assets",
  "Safety Assets",
  "Vehicle Assets",
  "Furniture Assets",
  "Software License Assets",
  "Admin Facility Assets",
  "Maintenance Assets"
];

export function sanitizeSqlName(name: string): string {
  // Replace non-alphanumeric characters with underscores
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}

let dbInstance: Database | null = null;

export function isLocalSqliteEnabled(): boolean {
  return !process.env.VERCEL && !process.env.NETLIFY && process.env.DISABLE_SQLITE !== "true";
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (!isLocalSqliteEnabled()) {
    throw new Error("Local SQLite is disabled in this serverless environment.");
  }

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, "assets.db");

  const [{ default: sqlite3 }, { open }] = await Promise.all([
    import("sqlite3"),
    import("sqlite"),
  ]);

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Initialize tables for categories based on the expected Google Sheets format
  for (const category of CATEGORIES) {
    const tableName = sanitizeSqlName(category);
    const isItAssets = category === "IT Assets";
    const headers = isItAssets ? [...CATEGORY_HEADERS, ...IT_EXTRA_HEADERS] : CATEGORY_HEADERS;

    const columnDefs = headers.map(h => `${sanitizeSqlName(h)} TEXT`).join(",\n  ");
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnDefs},
        PRIMARY KEY (${sanitizeSqlName("Asset ID")})
      )
    `;
    await db.exec(createTableQuery);
  }

  dbInstance = db;
  return db;
}

// Ensures that the table has all columns that match the Google Sheet's dynamic headers
export async function ensureColumnsExist(tableName: string, headersList: string[]) {
  const db = await getDb();
  const existingColsInfo = await db.all(`PRAGMA table_info(${tableName})`);
  const existingCols = existingColsInfo.map((c: any) => c.name);

  for (const header of headersList) {
    const sanitized = sanitizeSqlName(header);
    if (!existingCols.includes(sanitized)) {
      await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${sanitized} TEXT`);
    }
  }
}

export async function insertAssetLocal(category: string, mappedRow: any[], headersList: string[]) {
  try {
    if (!isLocalSqliteEnabled()) return;
    const db = await getDb();
    const tableName = sanitizeSqlName(category);
    
    // Create the table implicitly if it somehow doesn't exist for a custom category
    await db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (${sanitizeSqlName("Asset ID")} TEXT PRIMARY KEY)`);
    await ensureColumnsExist(tableName, headersList);
    
    const columns = headersList.map(sanitizeSqlName);
    const placeholders = columns.map(() => "?").join(", ");
    
    const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;

    await db.run(sql, mappedRow);
    console.log(`Local SQLite: Inserted asset into ${tableName}`);
  } catch (error) {
    console.error(`Error inserting local SQLite asset in ${category}:`, error);
  }
}

export async function updateAssetLocal(category: string, assetId: string, mappedRow: any[], headersList: string[]) {
  try {
    if (!isLocalSqliteEnabled()) return;
    const db = await getDb();
    const tableName = sanitizeSqlName(category);

    await db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (${sanitizeSqlName("Asset ID")} TEXT PRIMARY KEY)`);
    await ensureColumnsExist(tableName, headersList);

    const columns = headersList.map(sanitizeSqlName);
    const setClause = columns.map(c => `${c} = ?`).join(", ");
    
    const idColumn = sanitizeSqlName("Asset ID");
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${idColumn} = ?`;

    // Attempt update
    const result = await db.run(sql, [...mappedRow, assetId]);
    if (result.changes === 0) {
      // Fallback: If it didn't exist locally, we insert it
      await insertAssetLocal(category, mappedRow, headersList);
    } else {
      console.log(`Local SQLite: Updated asset ${assetId} in ${tableName}`);
    }
  } catch (error) {
    console.error(`Error updating local SQLite asset in ${category}:`, error);
  }
}

export async function deleteAssetLocal(assetId: string) {
  try {
    if (!isLocalSqliteEnabled()) return;
    const db = await getDb();
    const idColumn = sanitizeSqlName("Asset ID");
    
    for (const category of CATEGORIES) {
      const tableName = sanitizeSqlName(category);
      // Delete across all standard category tables
      const sql = `DELETE FROM ${tableName} WHERE ${idColumn} = ?`;
      await db.run(sql, [assetId]);
    }
    console.log(`Local SQLite: Deleted asset ${assetId}`);
  } catch (error) {
    console.error(`Error deleting local SQLite asset ${assetId}:`, error);
  }
}

export async function syncBulkAssetsLocal(category: string, rows: any[][], headersList: string[]) {
  try {
    if (!isLocalSqliteEnabled()) return;
    const db = await getDb();
    const tableName = sanitizeSqlName(category);

    await db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (${sanitizeSqlName("Asset ID")} TEXT PRIMARY KEY)`);
    await ensureColumnsExist(tableName, headersList);

    const columns = headersList.map(sanitizeSqlName);
    const placeholders = columns.map(() => "?").join(", ");
    
    const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;

    await db.exec("BEGIN TRANSACTION");
    const stmt = await db.prepare(sql);
    for (const row of rows) {
      await stmt.run(row);
    }
    await stmt.finalize();
    await db.exec("COMMIT");
    console.log(`Local SQLite: Bulk synced ${rows.length} assets into ${tableName}`);
  } catch (error) {
    console.error(`Error bulk syncing local SQLite assets in ${category}:`, error);
  }
}
