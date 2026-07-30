import type { ShareMode } from "@prisma/client";

export function isPlaybackVisible(
  shareMode: ShareMode,
  itemId: string | null,
  seriesId: string | null,
  selectedIds: ReadonlySet<string>
): boolean {
  if (!itemId || shareMode === "NONE") return false;
  if (shareMode === "ALL" || shareMode === "ONLY_WATCHING") return true;
  return selectedIds.has(itemId) || Boolean(seriesId && selectedIds.has(seriesId));
}

export function isHistoryItemVisible(
  shareMode: ShareMode,
  itemId: string,
  seriesId: string | null,
  selectedIds: ReadonlySet<string>
): boolean {
  if (shareMode === "ALL") return true;
  if (shareMode !== "SELECTED") return false;
  return selectedIds.has(itemId) || Boolean(seriesId && selectedIds.has(seriesId));
}
