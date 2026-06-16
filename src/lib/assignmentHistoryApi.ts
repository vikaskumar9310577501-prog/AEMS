export async function deleteAssignmentHistoryRecord(
  historyId: string,
  userEmail: string
): Promise<{ sheetWarning?: string }> {
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL || ''}/api/assignment-history/${encodeURIComponent(historyId)}?userEmail=${encodeURIComponent(userEmail)}`,
    { method: 'DELETE' }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Delete failed');
  }
  return { sheetWarning: (data as { sheetWarning?: string }).sheetWarning };
}
