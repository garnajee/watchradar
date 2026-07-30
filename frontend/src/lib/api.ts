export const API_URL = "/api";

type ApiErrorShape = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include"
    })
      .then((response) => response.ok)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  const canRefresh =
    path === "/auth/me" || !path.startsWith("/auth/");
  if (response.status === 401 && retry && canRefresh) {
    if (await refreshSession()) return apiFetch<T>(path, options, false);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
    throw new ApiError(
      payload.error?.message ?? "REQUEST_FAILED",
      response.status,
      payload.error?.code ?? "REQUEST_FAILED"
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function assetUrl(path: string): string | null {
  if (path.startsWith(`${API_URL}/media/`)) return path;
  if (!path.startsWith("/media/")) return null;
  return `${API_URL}${path}`;
}
