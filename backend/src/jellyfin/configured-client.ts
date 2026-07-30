import { config } from "../config.js";
import { prisma } from "../db.js";
import { ApiError } from "../lib/api-error.js";
import { decryptValue } from "../lib/crypto.js";
import { JellyfinClient } from "./client.js";

type ConfiguredJellyfinClient = {
  client: JellyfinClient;
  url: string;
  apiKey: string;
};

type StoredJellyfinConfig = {
  jellyfinUrl: string;
  encryptedApiKey: string | null;
} | null;

type JellyfinEnvironment = Pick<
  typeof config,
  "encryptionKey" | "jellyfinApiKey" | "jellyfinUrl"
>;

let configuredClientPromise: Promise<ConfiguredJellyfinClient> | null = null;

export function resolveConfiguredJellyfinValues(
  stored: StoredJellyfinConfig,
  environment: JellyfinEnvironment = config
): { url: string; apiKey: string } {
  const jellyfinUrl = stored?.jellyfinUrl || environment.jellyfinUrl;
  if (!jellyfinUrl) {
    throw new ApiError(412, "La configuration Jellyfin est incomplète.", "SETUP_REQUIRED");
  }
  let apiKey = environment.jellyfinApiKey;
  if (stored?.encryptedApiKey) {
    try {
      apiKey = decryptValue(stored.encryptedApiKey, environment.encryptionKey);
    } catch {
      throw new ApiError(
        412,
        "La clé API Jellyfin ne peut pas être déchiffrée. Enregistrez-la à nouveau.",
        "SETUP_REQUIRED"
      );
    }
  }
  if (!apiKey) {
    throw new ApiError(412, "La configuration Jellyfin est incomplète.", "SETUP_REQUIRED");
  }
  return { url: jellyfinUrl, apiKey };
}

export function invalidateConfiguredJellyfinClient(): void {
  configuredClientPromise = null;
}

async function loadConfiguredJellyfinClient(): Promise<ConfiguredJellyfinClient> {
  const stored = await prisma.adminConfig.findUnique({ where: { id: 1 } });
  const { url, apiKey } = resolveConfiguredJellyfinValues(stored);
  return {
    client: new JellyfinClient(url, apiKey, config.jellyfinTlsRejectUnauthorized),
    url,
    apiKey
  };
}

export function getConfiguredJellyfinClient(): Promise<ConfiguredJellyfinClient> {
  if (!configuredClientPromise) {
    configuredClientPromise = loadConfiguredJellyfinClient().catch((error: unknown) => {
      configuredClientPromise = null;
      throw error;
    });
  }
  return configuredClientPromise;
}
