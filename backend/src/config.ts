import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const booleanString = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

const originSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).origin === value, "must be an origin without a path");
const jellyfinUrlSchema = z.union([
  z.literal(""),
  z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === "https:", "must use HTTPS")
]);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().max(65_535).default(3000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    ENCRYPTION_KEY: z
      .string()
      .regex(
        /^[a-fA-F0-9]{64}$/,
        "ENCRYPTION_KEY must contain exactly 64 hexadecimal characters"
      ),
    FRONTEND_ORIGIN: originSchema,
    COOKIE_SECURE: booleanString,
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(2),
    JELLYFIN_TLS_REJECT_UNAUTHORIZED: booleanString,
    JELLYFIN_URL: jellyfinUrlSchema.optional().default(""),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info")
  })
  .superRefine((value, context) => {
    if (value.JWT_SECRET === value.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_REFRESH_SECRET"],
        message: "must be different from JWT_SECRET"
      });
    }
    if (value.NODE_ENV === "production") {
      if (new URL(value.FRONTEND_ORIGIN).protocol !== "https:") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["FRONTEND_ORIGIN"],
          message: "must use HTTPS in production"
        });
      }
      if (!value.COOKIE_SECURE) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["COOKIE_SECURE"],
          message: "must be true in production"
        });
      }
    }
  });

export function parseConfig(environment: NodeJS.ProcessEnv) {
  const parsed = envSchema.safeParse(environment);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    jwtSecret: parsed.data.JWT_SECRET,
    jwtRefreshSecret: parsed.data.JWT_REFRESH_SECRET,
    encryptionKey: parsed.data.ENCRYPTION_KEY,
    frontendOrigin: parsed.data.FRONTEND_ORIGIN,
    cookieSecure: parsed.data.COOKIE_SECURE,
    trustProxyHops: parsed.data.TRUST_PROXY_HOPS,
    jellyfinTlsRejectUnauthorized: parsed.data.JELLYFIN_TLS_REJECT_UNAUTHORIZED,
    jellyfinUrl: parsed.data.JELLYFIN_URL,
    logLevel: parsed.data.LOG_LEVEL
  } as const;
}

export const config = parseConfig(process.env);
