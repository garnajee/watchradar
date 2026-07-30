import { rateLimit } from "express-rate-limit";

function limiter(limit: number, message: string) {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: {
        code: "TOO_MANY_REQUESTS",
        message
      }
    }
  });
}

// These routes fan out to Jellyfin and are intentionally stricter than the
// inexpensive JSON API limit.
export const jellyfinReadLimiter = limiter(
  120,
  "Trop de lectures Jellyfin. Réessayez dans quelques instants."
);

// A dashboard may legitimately load dozens of covers at once, while this cap
// still prevents one authenticated client from turning the image relay into an
// unbounded bandwidth proxy.
export const mediaReadLimiter = limiter(
  300,
  "Trop d’images demandées. Réessayez dans quelques instants."
);
