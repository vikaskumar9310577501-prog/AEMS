/** True when employee must not receive new asset assignments (return-only). */
export function isInactiveEmployeeStatus(status: string | undefined): boolean {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "inactive" || normalized === "deactive" || normalized === "deactivated";
}
