import type { Readable } from "node:stream";
import { Agent, fetch, request } from "undici";
import { ApiError } from "../lib/api-error.js";
import type {
  JellyfinAuthenticationResult,
  JellyfinItem,
  JellyfinItemsResult,
  JellyfinSession,
  JellyfinUser
} from "./types.js";

const clientAuthorization =
  'MediaBrowser Client="WatchRadar", Device="Server", DeviceId="watchradar-backend", Version="1.0.0"';
const REQUEST_TIMEOUT_MS = 15_000;
const IMAGE_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const SAFE_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const dispatchers = new Map<boolean, Agent>();

function getDispatcher(rejectUnauthorized: boolean): Agent {
  const existing = dispatchers.get(rejectUnauthorized);
  if (existing) return existing;
  const dispatcher = new Agent({
    connect: { rejectUnauthorized, timeout: 10_000 },
    connections: 8,
    pipelining: 1,
    keepAliveTimeout: 10_000,
    keepAliveMaxTimeout: 60_000,
    headersTimeout: REQUEST_TIMEOUT_MS,
    bodyTimeout: IMAGE_TIMEOUT_MS,
    maxResponseSize: MAX_RESPONSE_BYTES
  });
  dispatchers.set(rejectUnauthorized, dispatcher);
  return dispatcher;
}

export async function closeJellyfinConnections(): Promise<void> {
  const agents = [...dispatchers.values()];
  dispatchers.clear();
  await Promise.all(agents.map((agent) => agent.close()));
}

export function normalizeJellyfinUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new ApiError(400, "L'URL Jellyfin doit utiliser HTTPS.", "JELLYFIN_HTTPS_REQUIRED");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ApiError(
      400,
      "L'URL Jellyfin ne doit contenir ni identifiants, ni paramètres, ni fragment.",
      "JELLYFIN_URL_INVALID"
    );
  }
  return url.toString().replace(/\/$/, "");
}

export class JellyfinClient {
  private readonly dispatcher: Agent;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
    rejectUnauthorized = true
  ) {
    this.dispatcher = getDispatcher(rejectUnauthorized);
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown; token?: string } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: clientAuthorization
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const token = options.token ?? this.apiKey;
    if (token) {
      headers["X-Emby-Token"] = token;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      dispatcher: this.dispatcher,
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new ApiError(
        response.status === 401 ? 401 : 502,
        response.status === 401
          ? "Identifiants ou clé API Jellyfin invalides."
          : `Jellyfin a répondu avec le statut ${response.status}.`,
        "JELLYFIN_ERROR"
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  authenticate(username: string, password: string): Promise<JellyfinAuthenticationResult> {
    return this.request<JellyfinAuthenticationResult>("/Users/AuthenticateByName", {
      method: "POST",
      body: { Username: username, Pw: password }
    });
  }

  getUsers(): Promise<JellyfinUser[]> {
    return this.request<JellyfinUser[]>("/Users");
  }

  getSessions(): Promise<JellyfinSession[]> {
    return this.request<JellyfinSession[]>("/Sessions");
  }

  getLibrary(userId: string, search = ""): Promise<JellyfinItemsResult> {
    const query = new URLSearchParams({
      Recursive: "true",
      IncludeItemTypes: "Movie,Series",
      SortBy: "SortName",
      SortOrder: "Ascending",
      Fields: "Overview,PrimaryImageAspectRatio",
      Limit: "60",
      EnableImages: "true"
    });
    if (search) query.set("SearchTerm", search);
    return this.request<JellyfinItemsResult>(`/Users/${encodeURIComponent(userId)}/Items?${query}`);
  }

  getResumeItems(userId: string): Promise<JellyfinItemsResult> {
    const query = new URLSearchParams({
      Limit: "40",
      MediaTypes: "Video",
      Fields: "Overview,PrimaryImageAspectRatio",
      EnableImages: "true",
      EnableUserData: "true"
    });
    return this.request<JellyfinItemsResult>(
      `/Users/${encodeURIComponent(userId)}/Items/Resume?${query}`
    );
  }

  getNextUp(userId: string): Promise<JellyfinItemsResult> {
    const query = new URLSearchParams({
      UserId: userId,
      Limit: "40",
      Fields: "Overview,PrimaryImageAspectRatio",
      EnableImages: "true",
      ImageTypeLimit: "1",
      EnableImageTypes: "Primary",
      EnableUserData: "true",
      EnableResumable: "true"
    });
    return this.request<JellyfinItemsResult>(`/Shows/NextUp?${query}`);
  }

  getPlayHistory(userId: string): Promise<JellyfinItemsResult> {
    const query = new URLSearchParams({
      UserId: userId,
      Recursive: "true",
      IncludeItemTypes: "Movie,Episode",
      IsPlayed: "true",
      SortBy: "DatePlayed",
      SortOrder: "Descending",
      Limit: "60",
      Fields: "Overview,PrimaryImageAspectRatio",
      EnableImages: "true",
      ImageTypeLimit: "1",
      EnableImageTypes: "Primary",
      EnableUserData: "true"
    });
    return this.request<JellyfinItemsResult>(`/Items?${query}`);
  }

  getImage(itemId: string, tag?: string): Promise<RemoteImage> {
    const query = new URLSearchParams({ maxWidth: "600", quality: "90" });
    if (tag) query.set("tag", tag);
    return this.getBinary(
      `/Items/${encodeURIComponent(itemId)}/Images/Primary?${query}`
    );
  }

  getUserImage(userId: string, tag?: string): Promise<RemoteImage> {
    const query = new URLSearchParams({ maxWidth: "300", quality: "90" });
    if (tag) query.set("tag", tag);
    return this.getBinary(
      `/Users/${encodeURIComponent(userId)}/Images/Primary?${query}`
    );
  }

  private async getBinary(path: string): Promise<RemoteImage> {
    const response = await request(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: clientAuthorization,
        ...(this.apiKey ? { "X-Emby-Token": this.apiKey } : {})
      },
      dispatcher: this.dispatcher,
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS)
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      await response.body.dump().catch(() => undefined);
      throw new ApiError(404, "Image introuvable.", "IMAGE_NOT_FOUND");
    }
    const rawContentType = response.headers["content-type"];
    const contentType = (Array.isArray(rawContentType) ? rawContentType[0] : rawContentType)
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();
    if (!contentType || !SAFE_IMAGE_TYPES.has(contentType)) {
      await response.body.dump().catch(() => undefined);
      throw new ApiError(415, "Format d’image non autorisé.", "UNSAFE_IMAGE_TYPE");
    }
    const rawContentLength = response.headers["content-length"];
    const contentLengthValue = Array.isArray(rawContentLength)
      ? rawContentLength[0]
      : rawContentLength;
    const contentLength = contentLengthValue ? Number(contentLengthValue) : undefined;
    if (
      contentLength !== undefined &&
      (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > MAX_RESPONSE_BYTES)
    ) {
      response.body.destroy();
      throw new ApiError(413, "Image trop volumineuse.", "IMAGE_TOO_LARGE");
    }
    return {
      contentType,
      ...(contentLength === undefined ? {} : { contentLength }),
      body: response.body
    };
  }
}

export type RemoteImage = {
  contentType: string;
  contentLength?: number;
  body: Readable;
};
