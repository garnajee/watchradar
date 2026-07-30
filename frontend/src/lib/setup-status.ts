export type ConfigurationStatus = {
  ready: boolean;
  jellyfinUrlConfigured: boolean;
  apiKeyConfigured: boolean;
};

export type ConfigurationWarningKey =
  | "setup.checkFailed"
  | "setup.missingUrl"
  | "setup.missingApiKey"
  | "setup.incomplete";

export function getConfigurationWarningKey(
  configuration: ConfigurationStatus | null,
  loadFailed: boolean
): ConfigurationWarningKey | null {
  if (loadFailed) {
    return "setup.checkFailed";
  }
  if (!configuration || configuration.ready) return null;
  if (!configuration.jellyfinUrlConfigured) {
    return "setup.missingUrl";
  }
  if (!configuration.apiKeyConfigured) {
    return "setup.missingApiKey";
  }
  return "setup.incomplete";
}
