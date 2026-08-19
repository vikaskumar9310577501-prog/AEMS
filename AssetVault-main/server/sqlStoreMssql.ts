import sql from "mssql";
import { getSqlPool } from "./sqlPool.js";

const TABLES = {
  Assets: { table: "dbo.Assets", id: "Id" },
  Employees: { table: "dbo.Employees", id: "EmployeeId" },
  Users: { table: "dbo.Users", id: "Email" },
  Inventory: { table: "dbo.Inventory", id: "ItemId" },
  AssignmentHistory: { table: "dbo.AssignmentHistory", id: "RecordId" },
  DamagedItems: { table: "dbo.DamagedItems", id: "RecordId" },
  MissingItems: { table: "dbo.MissingItems", id: "RecordId" },
  ExtraItems: { table: "dbo.ExtraItems", id: "RecordId" },
  Assignments: { table: "dbo.Assignments", id: "RecordId" },
  AuditLogs: { table: "dbo.AuditLogs", id: "LogId" },
  Categories: { table: "dbo.Categories", id: "CategoryName" },
  AssetTypesLookup: { table: "dbo.AssetTypesLookup", id: "TypeId" },
} as const;

export type JsonTable = keyof typeof TABLES;

function parseJson(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

export async function listJsonRows<T = Record<string, unknown>>(table: JsonTable): Promise<T[]> {
  const meta = TABLES[table];
  const pool = await getSqlPool();
  const result = await pool.request().query(`SELECT JsonData FROM ${meta.table}`);
  return result.recordset
    .map((row) => parseJson(row.JsonData) as T)
    .filter((row) => row != null) as T[];
}

export async function countJsonRows(table: JsonTable): Promise<number> {
  const meta = TABLES[table];
  const pool = await getSqlPool();
  const result = await pool.request().query(`SELECT COUNT(*) AS Cnt FROM ${meta.table}`);
  return Number(result.recordset[0]?.Cnt || 0);
}

export async function getJsonRow<T = Record<string, unknown>>(
  table: JsonTable,
  id: string
): Promise<T | null> {
  const meta = TABLES[table];
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("id", sql.NVarChar(256), id)
    .query(`SELECT JsonData FROM ${meta.table} WHERE ${meta.id} = @id`);
  if (!result.recordset[0]) return null;
  return (parseJson(result.recordset[0].JsonData) as T) || null;
}

export async function upsertJsonRow(
  table: JsonTable,
  id: string,
  data: unknown,
  extra?: Record<string, string | null | undefined>
): Promise<void> {
  const meta = TABLES[table];
  const pool = await getSqlPool();
  const json = JSON.stringify(data ?? {});
  const request = pool.request().input("id", sql.NVarChar(256), id).input("json", sql.NVarChar(sql.MAX), json);

  if (table === "Assets") {
    request
      .input("assetCode", sql.NVarChar(128), extra?.AssetCode ?? null)
      .input("serialNumber", sql.NVarChar(128), extra?.SerialNumber ?? null)
      .input("mainCategory", sql.NVarChar(128), extra?.MainCategory ?? null)
      .input("location", sql.NVarChar(128), extra?.Location ?? null)
      .input("plantCode", sql.NVarChar(64), extra?.PlantCode ?? null)
      .input("employeeId", sql.NVarChar(64), extra?.EmployeeId ?? null)
      .input("status", sql.NVarChar(64), extra?.Status ?? null);
    await request.query(`
      MERGE dbo.Assets AS t
      USING (SELECT @id AS Id) AS s ON t.Id = s.Id
      WHEN MATCHED THEN UPDATE SET
        AssetCode = @assetCode, SerialNumber = @serialNumber, MainCategory = @mainCategory,
        Location = @location, PlantCode = @plantCode, EmployeeId = @employeeId, Status = @status,
        JsonData = @json, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (Id, AssetCode, SerialNumber, MainCategory, Location, PlantCode, EmployeeId, Status, JsonData)
        VALUES (@id, @assetCode, @serialNumber, @mainCategory, @location, @plantCode, @employeeId, @status, @json);
    `);
    return;
  }

  if (table === "Employees") {
    request.input("email", sql.NVarChar(256), extra?.Email ?? null);
    await request.query(`
      MERGE dbo.Employees AS t
      USING (SELECT @id AS EmployeeId) AS s ON t.EmployeeId = s.EmployeeId
      WHEN MATCHED THEN UPDATE SET Email = @email, JsonData = @json, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (EmployeeId, Email, JsonData) VALUES (@id, @email, @json);
    `);
    return;
  }

  if (table === "Users") {
    request.input("role", sql.NVarChar(64), extra?.Role ?? null);
    await request.query(`
      MERGE dbo.Users AS t
      USING (SELECT @id AS Email) AS s ON t.Email = s.Email
      WHEN MATCHED THEN UPDATE SET Role = @role, JsonData = @json, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (Email, Role, JsonData) VALUES (@id, @role, @json);
    `);
    return;
  }

  if (table === "AssignmentHistory") {
    request.input("assetId", sql.NVarChar(64), extra?.AssetId ?? null);
    await request.query(`
      MERGE dbo.AssignmentHistory AS t
      USING (SELECT @id AS RecordId) AS s ON t.RecordId = s.RecordId
      WHEN MATCHED THEN UPDATE SET AssetId = @assetId, JsonData = @json, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (RecordId, AssetId, JsonData) VALUES (@id, @assetId, @json);
    `);
    return;
  }

  if (table === "AuditLogs") {
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.AuditLogs WHERE LogId = @id)
        UPDATE dbo.AuditLogs SET JsonData = @json WHERE LogId = @id
      ELSE
        INSERT INTO dbo.AuditLogs (LogId, JsonData) VALUES (@id, @json);
    `);
    return;
  }

  await request.query(`
    MERGE ${meta.table} AS t
    USING (SELECT @id AS Id) AS s ON t.${meta.id} = s.Id
    WHEN MATCHED THEN UPDATE SET JsonData = @json, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (${meta.id}, JsonData) VALUES (@id, @json);
  `);
}

export async function deleteJsonRow(table: JsonTable, id: string): Promise<boolean> {
  const meta = TABLES[table];
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("id", sql.NVarChar(256), id)
    .query(`DELETE FROM ${meta.table} WHERE ${meta.id} = @id`);
  return (result.rowsAffected[0] || 0) > 0;
}

export async function replaceAllJsonRows(
  table: JsonTable,
  rows: Array<{ id: string; data: unknown; extra?: Record<string, string | null | undefined> }>
): Promise<void> {
  const meta = TABLES[table];
  const pool = await getSqlPool();
  await pool.request().query(`DELETE FROM ${meta.table}`);
  for (const row of rows) {
    await upsertJsonRow(table, row.id, row.data, row.extra);
  }
}

export async function getAssetDetailsMap(): Promise<Record<string, Record<string, string>>> {
  const pool = await getSqlPool();
  const result = await pool.request().query(`SELECT AssetId, FieldKey, FieldValue FROM dbo.AssetDetails`);
  const map: Record<string, Record<string, string>> = {};
  for (const row of result.recordset) {
    const assetId = String(row.AssetId || "");
    if (!assetId) continue;
    if (!map[assetId]) map[assetId] = {};
    map[assetId][String(row.FieldKey)] = String(row.FieldValue ?? "");
  }
  return map;
}

export async function saveAssetDetails(assetId: string, details: Record<string, string>): Promise<void> {
  const pool = await getSqlPool();
  await pool.request().input("assetId", sql.NVarChar(64), assetId).query(`DELETE FROM dbo.AssetDetails WHERE AssetId = @assetId`);
  for (const [key, value] of Object.entries(details || {})) {
    if (!String(key).trim()) continue;
    await pool
      .request()
      .input("assetId", sql.NVarChar(64), assetId)
      .input("fieldKey", sql.NVarChar(128), key)
      .input("fieldValue", sql.NVarChar(sql.MAX), String(value ?? ""))
      .query(
        `INSERT INTO dbo.AssetDetails (AssetId, FieldKey, FieldValue) VALUES (@assetId, @fieldKey, @fieldValue)`
      );
  }
}

export async function deleteAssetDetails(assetId: string): Promise<void> {
  const pool = await getSqlPool();
  await pool.request().input("assetId", sql.NVarChar(64), assetId).query(`DELETE FROM dbo.AssetDetails WHERE AssetId = @assetId`);
}

export async function listLocations(): Promise<Array<{ name: string; department?: string }>> {
  const pool = await getSqlPool();
  const result = await pool.request().query(`SELECT LocationName, Department FROM dbo.Locations`);
  return result.recordset.map((row) => ({
    name: String(row.LocationName || ""),
    department: String(row.Department || ""),
  }));
}

export async function listPlants(): Promise<Array<{ code: string; name: string; location: string }>> {
  const pool = await getSqlPool();
  const result = await pool.request().query(`SELECT PlantCode, PlantName, LocationName FROM dbo.Plants`);
  return result.recordset.map((row) => ({
    code: String(row.PlantCode || ""),
    name: String(row.PlantName || ""),
    location: String(row.LocationName || ""),
  }));
}

export async function replaceLocationsPlants(
  locations: string[],
  plants: Array<{ code: string; name: string; location: string }>
): Promise<void> {
  const pool = await getSqlPool();
  await pool.request().query(`DELETE FROM dbo.Locations; DELETE FROM dbo.Plants;`);
  for (const name of locations) {
    const clean = String(name || "").trim();
    if (!clean) continue;
    await pool
      .request()
      .input("name", sql.NVarChar(128), clean)
      .input("created", sql.NVarChar(64), new Date().toISOString())
      .query(`INSERT INTO dbo.Locations (LocationName, CreatedDate) VALUES (@name, @created)`);
  }
  for (const plant of plants) {
    const code = String(plant.code || "").trim();
    if (!code) continue;
    await pool
      .request()
      .input("code", sql.NVarChar(64), code)
      .input("name", sql.NVarChar(256), plant.name || "")
      .input("location", sql.NVarChar(128), plant.location || "")
      .input("created", sql.NVarChar(64), new Date().toISOString())
      .query(
        `INSERT INTO dbo.Plants (PlantCode, PlantName, LocationName, CreatedDate) VALUES (@code, @name, @location, @created)`
      );
  }
}

export async function listCatalogOptions(): Promise<Record<string, string[]>> {
  const pool = await getSqlPool();
  const result = await pool.request().query(`SELECT OptionType, OptionValue FROM dbo.CatalogOptions`);
  const options: Record<string, string[]> = {};
  for (const row of result.recordset) {
    const type = String(row.OptionType || "");
    const value = String(row.OptionValue || "");
    if (!type || !value) continue;
    if (!options[type]) options[type] = [];
    options[type].push(value);
  }
  return options;
}

export async function addCatalogOption(type: string, value: string): Promise<void> {
  const pool = await getSqlPool();
  await pool
    .request()
    .input("type", sql.NVarChar(64), type)
    .input("value", sql.NVarChar(256), value)
    .query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.CatalogOptions WHERE OptionType = @type AND OptionValue = @value)
       INSERT INTO dbo.CatalogOptions (OptionType, OptionValue) VALUES (@type, @value)`
    );
}

export async function deleteCatalogOption(type: string, value: string): Promise<void> {
  const pool = await getSqlPool();
  await pool
    .request()
    .input("type", sql.NVarChar(64), type)
    .input("value", sql.NVarChar(256), value)
    .query(`DELETE FROM dbo.CatalogOptions WHERE OptionType = @type AND OptionValue = @value`);
}

export async function getAppSettingsJson(): Promise<Record<string, unknown> | null> {
  const pool = await getSqlPool();
  const result = await pool.request().query(`SELECT JsonData FROM dbo.AppSettings WHERE Id = 1`);
  return (parseJson(result.recordset[0]?.JsonData) as Record<string, unknown>) || null;
}

export async function saveAppSettingsJson(data: unknown): Promise<void> {
  const pool = await getSqlPool();
  await pool
    .request()
    .input("json", sql.NVarChar(sql.MAX), JSON.stringify(data ?? {}))
    .query(`
      IF EXISTS (SELECT 1 FROM dbo.AppSettings WHERE Id = 1)
        UPDATE dbo.AppSettings SET JsonData = @json, UpdatedAt = SYSUTCDATETIME() WHERE Id = 1
      ELSE
        INSERT INTO dbo.AppSettings (Id, JsonData) VALUES (1, @json);
    `);
}

export async function getTypeDefinitionsJson(): Promise<unknown | null> {
  const pool = await getSqlPool();
  const result = await pool.request().query(`SELECT JsonData FROM dbo.TypeDefinitions WHERE Id = 1`);
  return parseJson(result.recordset[0]?.JsonData);
}

export async function saveTypeDefinitionsJson(data: unknown): Promise<void> {
  const pool = await getSqlPool();
  await pool
    .request()
    .input("json", sql.NVarChar(sql.MAX), JSON.stringify(data ?? {}))
    .query(`
      IF EXISTS (SELECT 1 FROM dbo.TypeDefinitions WHERE Id = 1)
        UPDATE dbo.TypeDefinitions SET JsonData = @json, UpdatedAt = SYSUTCDATETIME() WHERE Id = 1
      ELSE
        INSERT INTO dbo.TypeDefinitions (Id, JsonData) VALUES (1, @json);
    `);
}

export async function saveOtp(email: string, otp: string, expiry: Date): Promise<void> {
  const pool = await getSqlPool();
  await pool
    .request()
    .input("email", sql.NVarChar(256), email)
    .input("otp", sql.NVarChar(16), otp)
    .input("expiry", sql.DateTime2, expiry)
    .query(`
      MERGE dbo.OtpLog AS t
      USING (SELECT @email AS Email) AS s ON t.Email = s.Email
      WHEN MATCHED THEN UPDATE SET Otp = @otp, Expiry = @expiry, Attempts = 0, RequestedAt = SYSUTCDATETIME(), Status = N'sent'
      WHEN NOT MATCHED THEN INSERT (Email, Otp, Expiry, Attempts, Status) VALUES (@email, @otp, @expiry, 0, N'sent');
    `);
}

export async function readOtp(email: string): Promise<{ otp: string; expiry: Date; attempts: number } | null> {
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("email", sql.NVarChar(256), email)
    .query(`SELECT Otp, Expiry, Attempts FROM dbo.OtpLog WHERE Email = @email`);
  const row = result.recordset[0];
  if (!row) return null;
  return { otp: String(row.Otp), expiry: new Date(row.Expiry), attempts: Number(row.Attempts || 0) };
}

export async function bumpOtpAttempts(email: string, attempts: number): Promise<void> {
  const pool = await getSqlPool();
  await pool
    .request()
    .input("email", sql.NVarChar(256), email)
    .input("attempts", sql.Int, attempts)
    .query(`UPDATE dbo.OtpLog SET Attempts = @attempts WHERE Email = @email`);
}

export async function deleteOtp(email: string): Promise<void> {
  const pool = await getSqlPool();
  await pool.request().input("email", sql.NVarChar(256), email).query(`DELETE FROM dbo.OtpLog WHERE Email = @email`);
}

export async function saveUploadedFile(record: {
  fileId: string;
  fileName: string;
  mimeType: string;
  diskPath: string;
  url: string;
}): Promise<void> {
  const pool = await getSqlPool();
  await pool
    .request()
    .input("fileId", sql.NVarChar(128), record.fileId)
    .input("fileName", sql.NVarChar(256), record.fileName)
    .input("mimeType", sql.NVarChar(128), record.mimeType)
    .input("diskPath", sql.NVarChar(512), record.diskPath)
    .input("url", sql.NVarChar(sql.MAX), record.url)
    .query(
      `INSERT INTO dbo.UploadedFiles (FileId, FileName, MimeType, DiskPath, Url)
       VALUES (@fileId, @fileName, @mimeType, @diskPath, @url)`
    );
}

export async function getUploadedFile(fileId: string): Promise<{
  fileId: string;
  fileName: string;
  mimeType: string;
  diskPath: string;
  url: string;
} | null> {
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input("fileId", sql.NVarChar(128), fileId)
    .query(`SELECT FileId, FileName, MimeType, DiskPath, Url FROM dbo.UploadedFiles WHERE FileId = @fileId`);
  const row = result.recordset[0];
  if (!row) return null;
  return {
    fileId: String(row.FileId),
    fileName: String(row.FileName || ""),
    mimeType: String(row.MimeType || ""),
    diskPath: String(row.DiskPath || ""),
    url: String(row.Url || ""),
  };
}
