import { isSupabaseMode } from "./sqlConfig.js";
import type { JsonTable } from "./sqlStoreMssql.js";
import * as mssqlStore from "./sqlStoreMssql.js";
import * as supabaseStore from "./supabaseStore.js";

export type { JsonTable };

function store() {
  return isSupabaseMode() ? supabaseStore : mssqlStore;
}

export async function listJsonRows<T = Record<string, unknown>>(table: JsonTable): Promise<T[]> {
  return store().listJsonRows<T>(table);
}
export async function countJsonRows(table: JsonTable): Promise<number> {
  return store().countJsonRows(table);
}
export async function getJsonRow<T = Record<string, unknown>>(table: JsonTable, id: string): Promise<T | null> {
  return store().getJsonRow<T>(table, id);
}
export async function upsertJsonRow(
  table: JsonTable,
  id: string,
  data: unknown,
  extra?: Record<string, string | null | undefined>
): Promise<void> {
  return store().upsertJsonRow(table, id, data, extra);
}
export async function deleteJsonRow(table: JsonTable, id: string): Promise<boolean> {
  return store().deleteJsonRow(table, id);
}
export async function replaceAllJsonRows(
  table: JsonTable,
  rows: Array<{ id: string; data: unknown; extra?: Record<string, string | null | undefined> }>
): Promise<void> {
  return store().replaceAllJsonRows(table, rows);
}
export async function getAssetDetailsMap(): Promise<Record<string, Record<string, string>>> {
  return store().getAssetDetailsMap();
}
export async function saveAssetDetails(assetId: string, details: Record<string, string>): Promise<void> {
  return store().saveAssetDetails(assetId, details);
}
export async function deleteAssetDetails(assetId: string): Promise<void> {
  return store().deleteAssetDetails(assetId);
}
export async function listLocations(): Promise<Array<{ name: string; department?: string }>> {
  return store().listLocations();
}
export async function listPlants(): Promise<Array<{ code: string; name: string; location: string }>> {
  return store().listPlants();
}
export async function replaceLocationsPlants(
  locations: string[],
  plants: Array<{ code: string; name: string; location: string }>
): Promise<void> {
  return store().replaceLocationsPlants(locations, plants);
}
export async function listCatalogOptions(): Promise<Record<string, string[]>> {
  return store().listCatalogOptions();
}
export async function addCatalogOption(type: string, value: string): Promise<void> {
  return store().addCatalogOption(type, value);
}
export async function deleteCatalogOption(type: string, value: string): Promise<void> {
  return store().deleteCatalogOption(type, value);
}
export async function getAppSettingsJson(): Promise<Record<string, unknown> | null> {
  return store().getAppSettingsJson();
}
export async function saveAppSettingsJson(data: unknown): Promise<void> {
  return store().saveAppSettingsJson(data);
}
export async function getTypeDefinitionsJson(): Promise<unknown | null> {
  return store().getTypeDefinitionsJson();
}
export async function saveTypeDefinitionsJson(data: unknown): Promise<void> {
  return store().saveTypeDefinitionsJson(data);
}
export async function saveOtp(email: string, otp: string, expiry: Date): Promise<void> {
  return store().saveOtp(email, otp, expiry);
}
export async function readOtp(email: string): Promise<{ otp: string; expiry: Date; attempts: number } | null> {
  return store().readOtp(email);
}
export async function bumpOtpAttempts(email: string, attempts: number): Promise<void> {
  return store().bumpOtpAttempts(email, attempts);
}
export async function deleteOtp(email: string): Promise<void> {
  return store().deleteOtp(email);
}
export async function saveUploadedFile(record: {
  fileId: string;
  fileName: string;
  mimeType: string;
  diskPath: string;
  url: string;
}): Promise<void> {
  return store().saveUploadedFile(record);
}
export async function getUploadedFile(fileId: string): Promise<{
  fileId: string;
  fileName: string;
  mimeType: string;
  diskPath: string;
  url: string;
} | null> {
  return store().getUploadedFile(fileId);
}
