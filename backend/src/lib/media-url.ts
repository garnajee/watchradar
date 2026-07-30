import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

export type MediaKind = "item" | "user";

const DAY_SECONDS = 24 * 60 * 60;
const MAX_VALIDITY_SECONDS = 2 * DAY_SECONDS + 60;

function signaturePayload(
  viewerId: number,
  kind: MediaKind,
  resourceId: string,
  tag: string,
  expiresAt: number
): string {
  return [viewerId, kind, resourceId, tag, expiresAt].join("\n");
}

function signPayload(payload: string): string {
  return createHmac("sha256", config.jwtSecret)
    .update("watchradar-media-v1\0")
    .update(payload)
    .digest("hex");
}

export function signedMediaUrl(
  viewerId: number,
  kind: MediaKind,
  resourceId: string,
  tag?: string | null,
  now = Date.now()
): string {
  const normalizedTag = tag ?? "";
  const nowSeconds = Math.floor(now / 1000);
  const expiresAt = (Math.floor(nowSeconds / DAY_SECONDS) + 2) * DAY_SECONDS;
  const signature = signPayload(
    signaturePayload(viewerId, kind, resourceId, normalizedTag, expiresAt)
  );
  const params = new URLSearchParams({
    exp: String(expiresAt),
    sig: signature
  });
  if (normalizedTag) params.set("tag", normalizedTag);
  const resource =
    kind === "item"
      ? `/media/items/${encodeURIComponent(resourceId)}/image`
      : `/media/users/${encodeURIComponent(resourceId)}/avatar`;
  return `${resource}?${params}`;
}

export function verifyMediaSignature(input: {
  viewerId: number;
  kind: MediaKind;
  resourceId: string;
  tag?: string;
  expiresAt: string;
  signature: string;
  now?: number;
}): boolean {
  if (!/^[a-f0-9]{64}$/.test(input.signature) || !/^[0-9]{1,12}$/.test(input.expiresAt)) {
    return false;
  }
  const expiresAt = Number(input.expiresAt);
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < nowSeconds ||
    expiresAt > nowSeconds + MAX_VALIDITY_SECONDS
  ) {
    return false;
  }
  const expected = signPayload(
    signaturePayload(
      input.viewerId,
      input.kind,
      input.resourceId,
      input.tag ?? "",
      expiresAt
    )
  );
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(input.signature, "hex"));
}
