import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL, apiFetch, assetUrl } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API URL", () => {
  it("uses the same-origin reverse-proxy path by default", () => {
    expect(API_URL).toBe("/api");
  });

  it("builds relative media URLs through the API path", () => {
    expect(assetUrl("/media/users/1/avatar")).toBe("/api/media/users/1/avatar");
  });

  it("rejects external media URLs", () => {
    expect(assetUrl("https://jellyfin.example.com/image.jpg")).toBeNull();
  });

  it("renews an expired access token while restoring the user on startup", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        Response.json({ user: { id: 7, name: "Ada", isAdmin: false } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch<{ user: { id: number } }>("/auth/me");

    expect(result.user.id).toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/auth/me",
      "/api/auth/refresh",
      "/api/auth/me"
    ]);
  });

  it("does not try to renew a rejected login", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "UNAUTHENTICATED", message: "Identifiants incorrects." } },
          { status: 401 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "Ada", password: "incorrect" })
      })
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
