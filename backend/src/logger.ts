import pino, { type LoggerOptions } from "pino";
import { config } from "./config.js";

export const loggerOptions = {
  level: config.logLevel,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers[\"set-cookie\"]",
      "req.url",
      "req.originalUrl",
      "req.query",
      "password",
      "apiKey",
      "*.password",
      "*.apiKey"
    ],
    censor: "[redacted]"
  }
} satisfies LoggerOptions;

export const logger = pino(loggerOptions);
