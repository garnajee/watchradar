import pino, { type DestinationStream } from "pino";
import { describe, expect, it } from "vitest";
import { loggerOptions } from "./logger.js";

describe("logger redaction", () => {
  it("never writes request credentials, signed URLs, or response cookies", () => {
    const chunks: string[] = [];
    const destination: DestinationStream = {
      write(message: string) {
        chunks.push(message);
      }
    };
    const auditLogger = pino({ ...loggerOptions, level: "info" }, destination);

    auditLogger.info({
      req: {
        url: "/api/media/items/secret?sig=media-signature",
        originalUrl: "/api/media/items/secret?sig=media-signature",
        query: { exp: "9999999999", sig: "media-signature" },
        headers: {
          authorization: "Bearer access-secret",
          cookie: "access_token=request-secret"
        }
      },
      res: {
        headers: {
          "set-cookie": [
            "access_token=response-access-secret; HttpOnly; Secure",
            "refresh_token=response-refresh-secret; HttpOnly; Secure"
          ]
        }
      }
    });

    const output = chunks.join("");
    expect(output).not.toContain("access-secret");
    expect(output).not.toContain("request-secret");
    expect(output).not.toContain("response-access-secret");
    expect(output).not.toContain("response-refresh-secret");
    expect(output).not.toContain("media-signature");
    expect(output.match(/\[redacted\]/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });
});
