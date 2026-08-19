import sql from "mssql";
import { getSqlConnectionConfig } from "./sqlConfig.js";

let pool: sql.ConnectionPool | null = null;
let schemaReady = false;

const SCHEMA_SQL = `
IF OBJECT_ID(N'dbo.Assets', N'U') IS NULL
CREATE TABLE dbo.Assets (
  Id NVARCHAR(64) NOT NULL PRIMARY KEY,
  AssetCode NVARCHAR(128) NULL,
  SerialNumber NVARCHAR(128) NULL,
  MainCategory NVARCHAR(128) NULL,
  Location NVARCHAR(128) NULL,
  PlantCode NVARCHAR(64) NULL,
  EmployeeId NVARCHAR(64) NULL,
  Status NVARCHAR(64) NULL,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Assets_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Employees', N'U') IS NULL
CREATE TABLE dbo.Employees (
  EmployeeId NVARCHAR(64) NOT NULL PRIMARY KEY,
  Email NVARCHAR(256) NULL,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Employees_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
CREATE TABLE dbo.Users (
  Email NVARCHAR(256) NOT NULL PRIMARY KEY,
  Role NVARCHAR(64) NULL,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Inventory', N'U') IS NULL
CREATE TABLE dbo.Inventory (
  ItemId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Inventory_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.AssignmentHistory', N'U') IS NULL
CREATE TABLE dbo.AssignmentHistory (
  RecordId NVARCHAR(64) NOT NULL PRIMARY KEY,
  AssetId NVARCHAR(64) NULL,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_AssignmentHistory_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.DamagedItems', N'U') IS NULL
CREATE TABLE dbo.DamagedItems (
  RecordId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_DamagedItems_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.MissingItems', N'U') IS NULL
CREATE TABLE dbo.MissingItems (
  RecordId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_MissingItems_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.ExtraItems', N'U') IS NULL
CREATE TABLE dbo.ExtraItems (
  RecordId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_ExtraItems_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Assignments', N'U') IS NULL
CREATE TABLE dbo.Assignments (
  RecordId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Assignments_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NULL
CREATE TABLE dbo.AuditLogs (
  LogId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AuditLogs_CreatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.AssetDetails', N'U') IS NULL
CREATE TABLE dbo.AssetDetails (
  AssetId NVARCHAR(64) NOT NULL,
  FieldKey NVARCHAR(128) NOT NULL,
  FieldValue NVARCHAR(MAX) NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_AssetDetails_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_AssetDetails PRIMARY KEY (AssetId, FieldKey)
);

IF OBJECT_ID(N'dbo.Locations', N'U') IS NULL
CREATE TABLE dbo.Locations (
  LocationName NVARCHAR(128) NOT NULL PRIMARY KEY,
  Department NVARCHAR(128) NULL,
  CreatedDate NVARCHAR(64) NULL
);

IF OBJECT_ID(N'dbo.Plants', N'U') IS NULL
CREATE TABLE dbo.Plants (
  PlantCode NVARCHAR(64) NOT NULL PRIMARY KEY,
  PlantName NVARCHAR(256) NULL,
  LocationName NVARCHAR(128) NULL,
  CreatedDate NVARCHAR(64) NULL
);

IF OBJECT_ID(N'dbo.CatalogOptions', N'U') IS NULL
CREATE TABLE dbo.CatalogOptions (
  OptionType NVARCHAR(64) NOT NULL,
  OptionValue NVARCHAR(256) NOT NULL,
  CONSTRAINT PK_CatalogOptions PRIMARY KEY (OptionType, OptionValue)
);

IF OBJECT_ID(N'dbo.TypeDefinitions', N'U') IS NULL
CREATE TABLE dbo.TypeDefinitions (
  Id INT NOT NULL PRIMARY KEY CONSTRAINT DF_TypeDefinitions_Id DEFAULT 1,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_TypeDefinitions_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.AppSettings', N'U') IS NULL
CREATE TABLE dbo.AppSettings (
  Id INT NOT NULL PRIMARY KEY CONSTRAINT DF_AppSettings_Id DEFAULT 1,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_AppSettings_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.OtpLog', N'U') IS NULL
CREATE TABLE dbo.OtpLog (
  Email NVARCHAR(256) NOT NULL PRIMARY KEY,
  Otp NVARCHAR(16) NOT NULL,
  Expiry DATETIME2 NOT NULL,
  Attempts INT NOT NULL CONSTRAINT DF_OtpLog_Attempts DEFAULT 0,
  RequestedAt DATETIME2 NOT NULL CONSTRAINT DF_OtpLog_RequestedAt DEFAULT SYSUTCDATETIME(),
  Status NVARCHAR(32) NULL
);

IF OBJECT_ID(N'dbo.UploadedFiles', N'U') IS NULL
CREATE TABLE dbo.UploadedFiles (
  FileId NVARCHAR(128) NOT NULL PRIMARY KEY,
  FileName NVARCHAR(256) NULL,
  MimeType NVARCHAR(128) NULL,
  DiskPath NVARCHAR(512) NULL,
  Url NVARCHAR(MAX) NULL,
  UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_UploadedFiles_UploadedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Categories', N'U') IS NULL
CREATE TABLE dbo.Categories (
  CategoryName NVARCHAR(128) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Categories_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.AssetTypesLookup', N'U') IS NULL
CREATE TABLE dbo.AssetTypesLookup (
  TypeId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_AssetTypesLookup_UpdatedAt DEFAULT SYSUTCDATETIME()
);
`;

function connectionAttempts() {
  const base = getSqlConnectionConfig();
  const attempts: sql.config[] = [base];
  if (base.options?.instanceName) {
    attempts.push({
      ...base,
      server: `${base.server}\\${base.options.instanceName}`,
      options: { ...base.options, instanceName: undefined },
    });
    attempts.push({
      ...base,
      port: 57334,
      options: { ...base.options, instanceName: undefined },
    });
    attempts.push({
      ...base,
      server: "127.0.0.1",
      port: 57334,
      options: { ...base.options, instanceName: undefined },
    });
  }
  return attempts;
}

export async function getSqlPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  const errors: string[] = [];
  for (const config of connectionAttempts()) {
    try {
      pool = await new sql.ConnectionPool(config).connect();
      return pool;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`SQL Server connection failed: ${errors.join(" | ")}`);
}

export async function initSqlServer(): Promise<void> {
  const config = getSqlConnectionConfig();
  console.log(
    `[SQL] Connecting to ${config.server}${config.options.instanceName ? "\\" + config.options.instanceName : ""} / ${config.database}`
  );
  const connected = await getSqlPool();
  if (!schemaReady) {
    await connected.request().batch(SCHEMA_SQL);
    schemaReady = true;
    console.log("[SQL] Schema ready");
  }
}

export async function closeSqlPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    schemaReady = false;
  }
}
