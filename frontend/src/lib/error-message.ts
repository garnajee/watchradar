import { ApiError } from "./api";
import type { Translate, TranslationKey } from "./i18n";

const errorKeys: Partial<Record<string, TranslationKey>> = {
  TOO_MANY_ATTEMPTS: "errors.api.tooManyAttempts",
  TOO_MANY_REQUESTS: "errors.api.tooManyRequests",
  SETUP_REQUIRED: "errors.api.setupRequired",
  USER_DISABLED: "errors.api.userDisabled",
  UNAUTHENTICATED: "errors.api.unauthenticated",
  TOKEN_EXPIRED: "errors.api.unauthenticated",
  FORBIDDEN: "errors.api.forbidden",
  CORS_DENIED: "errors.api.originDenied",
  CSRF_DENIED: "errors.api.originDenied",
  NOT_FOUND: "errors.api.notFound",
  VALIDATION_ERROR: "errors.api.validation",
  INTERNAL_ERROR: "errors.api.internal",
  NOT_VISIBLE: "errors.api.notVisible",
  TOO_MANY_STREAMS: "errors.api.tooManyStreams",
  JELLYFIN_HTTPS_REQUIRED: "errors.api.jellyfinHttps",
  JELLYFIN_URL_INVALID: "errors.api.jellyfinUrlInvalid",
  INVALID_MEDIA_SIGNATURE: "errors.api.invalidMedia",
  IMAGE_NOT_FOUND: "errors.api.imageNotFound",
  UNSAFE_IMAGE_TYPE: "errors.api.unsafeImage",
  IMAGE_TOO_LARGE: "errors.api.imageTooLarge",
  REQUEST_FAILED: "errors.requestFailed"
};

export function localizedError(
  error: unknown,
  t: Translate,
  fallback: TranslationKey
): string {
  if (error instanceof ApiError) {
    if (error.code === "JELLYFIN_ERROR") {
      return t(
        error.status === 401
          ? "errors.api.jellyfinCredentials"
          : "errors.api.jellyfinUnavailable"
      );
    }
    const key = errorKeys[error.code];
    if (key) return t(key);
  }
  return t(fallback);
}
