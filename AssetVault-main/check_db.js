import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

async function main() {
  const dbPath = path.join(process.cwd(), 'data', 'assets.db');
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  console.log("Categories / Tables check:");
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
  console.log(tables);

  for (const t of tables) {
    const count = await db.get(`SELECT COUNT(*) as count FROM ${t.name}`);
    console.log(`Table ${t.name}: ${count.count} rows`);
    if (count.count > 0) {
      const sample = await db.all(`SELECT * FROM ${t.name} LIMIT 5`);
      console.log(`Sample from ${t.name}:`, sample.map(s => {
        // Find keys case-insensitively
        const keys = Object.keys(s);
        const assetIdKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid') || 'Asset_ID';
        const uniqueCodeKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === 'uniquecode') || 'Unique_Code';
        const assetCodeKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetcode') || 'Asset_Code';
        
        return {
          id: s[assetIdKey],
          uniqueCode: s[uniqueCodeKey],
          assetCode: s[assetCodeKey],
          name: s.Asset_Name || s.assetName || s.Model
        };
      }));
    }
  }
}

main().catch(console.error);
