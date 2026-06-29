import type { AppUser } from "./dataStore.js";
import {
  addUserToGoogleSheet,
  updateUserInGoogleSheet,
  deleteUserFromGoogleSheet,
} from "./sheetsUsers.js";
import { saveUserViaGas } from "./gasUsers.js";

type UserOp = "add_user" | "update_user" | "delete_user";

export async function persistUserToSheet(
  op: UserOp,
  user: AppUser,
  deps: {
    proxyToGas: (payload: Record<string, unknown>, timeoutMs?: number) => Promise<unknown>;
    spreadsheetId?: string;
    usersSheetGid: string;
  },
  emailForDelete?: string
): Promise<{ ok: boolean; error?: string; via?: string }> {
  const { proxyToGas, spreadsheetId, usersSheetGid } = deps;

  if (spreadsheetId) {
    let direct: { ok: boolean; error?: string } = { ok: false, error: "Not tried" };
    if (op === "add_user") {
      direct = await addUserToGoogleSheet(spreadsheetId, usersSheetGid, user);
    } else if (op === "update_user") {
      direct = await updateUserInGoogleSheet(spreadsheetId, usersSheetGid, user);
    } else {
      direct = await deleteUserFromGoogleSheet(
        spreadsheetId,
        usersSheetGid,
        emailForDelete || user.email
      );
    }
    if (direct.ok) return { ok: true, via: "google_api" };
  }

  const gas = await saveUserViaGas(proxyToGas, op, user, emailForDelete);
  if (gas.ok) return { ok: true, via: "gas" };

  return {
    ok: false,
    error:
      gas.error ||
      "Could not save to database. Deploy the latest backend script or set GOOGLE_SERVICE_ACCOUNT in .env",
  };
}
