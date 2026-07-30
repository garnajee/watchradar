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

let configuredClientPromise: Promise<ConfiguredJellyfinClient> | null = null;

export function invalidateConfiguredJellyfinClient(): void {
  configuredClientPromise = null;
}

async function loadConfiguredJellyfinClient(): Promise<ConfiguredJellyfinClient> {
  const stored = await prisma.adminConfig.findUnique({ where: { id: 1 } });
  if (!stored?.encryptedApiKey) {
    throw new ApiError(412, "La configuration Jellyfin est incomplète.", "SETUP_REQUIRED");
  }
  let apiKey: string;
  try {
    apiKey = decryptValue(stored.encryptedApiKey, config.encryptionKey);
  } catch {
    throw new ApiError(
      412,
      "La clé API Jellyfin ne peut pas être déchiffrée. Enregistrez-la à nouveau.",
      "SETUP_REQUIRED"
    );
  }
  return {
    client: new JellyfinClient(stored.jellyfinUrl, apiKey, config.jellyfinTlsRejectUnauthorized),
    url: stored.jellyfinUrl,
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
