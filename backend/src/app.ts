import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { ApiError } from "./lib/api-error.js";
import { logger } from "./logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requireTrustedOrigin } from "./middleware/trusted-origin.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { mediaRouter } from "./routes/media.js";
import { userRouter } from "./routes/user.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxyHops);
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (request) => request.url === "/api/health"
      },
      customLogLevel: (request, response, error) => {
        if (error || response.statusCode >= 500) return "error";
        if (response.statusCode >= 400) return "warn";
        if (request.url?.startsWith("/api/media/")) return "debug";
        return "info";
      }
    })
  );
  app.use(
    helmet({
      // Nginx is the only browser-facing service and owns these policies.
      // In particular, the internal HTTP API must not emit HSTS.
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      referrerPolicy: false,
      strictTransportSecurity: false,
      xContentTypeOptions: false,
      xFrameOptions: false
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === config.frontendOrigin) {
          callback(null, true);
          return;
        }
        callback(new ApiError(403, "Origine non autorisée.", "CORS_DENIED"));
      },
      credentials: true
    })
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 600,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      skip: (request) => request.path === "/health",
      message: {
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Trop de requêtes. Réessayez dans quelques instants."
        }
      }
    })
  );
  app.use(requireTrustedOrigin);
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", service: "watchradar-api" });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/user", userRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/media", mediaRouter);

  app.use((_request, _response, next) => {
    next(new ApiError(404, "Route introuvable.", "NOT_FOUND"));
  });
  app.use(errorHandler);
  return app;
}
