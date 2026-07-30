import { describe, expect, it } from "vitest";
import { config } from "../config.js";
import { isTrustedStateChangingRequest } from "./trusted-origin.js";

describe("state-changing request origin checks", () => {
  it("accepts safe methods without an Origin header", () => {
    expect(isTrustedStateChangingRequest({ method: "GET", headers: {} })).toBe(true);
  });

  it("accepts the configured browser origin", () => {
    expect(
      isTrustedStateChangingRequest({
        method: "POST",
        headers: { origin: config.frontendOrigin }
      })
    ).toBe(true);
  });

  it("rejects cookie-style writes from another origin", () => {
    expect(
      isTrustedStateChangingRequest({
        method: "PUT",
        headers: { origin: "https://attacker.example" }
      })
    ).toBe(false);
  });

  it("allows non-browser clients using a bearer token", () => {
    expect(
      isTrustedStateChangingRequest({
        method: "POST",
        headers: { authorization: "Bearer token" }
      })
    ).toBe(true);
  });
});
