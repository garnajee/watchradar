import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { ApiError } from "../lib/api-error.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isTrustedStateChangingRequest(request: Pick<Request, "method" | "headers">): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const authorization = request.headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) return true;
  return request.headers.origin === config.frontendOrigin;
}

export function requireTrustedOrigin(
  request: Request,
  _response: Response,
  next: NextFunction
): void {
  if (isTrustedStateChangingRequest(request)) {
    next();
    return;
  }
  next(new ApiError(403, "Origine de la requête non autorisée.", "CSRF_DENIED"));
}
