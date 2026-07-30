export type ConfigurationStatus = {
  ready: boolean;
  jellyfinUrlConfigured: boolean;
  apiKeyConfigured: boolean;
};

export function getConfigurationWarning(
  configuration: ConfigurationStatus | null,
  loadFailed: boolean
): string | null {
  if (loadFailed) {
    return "Impossible de vérifier la configuration. WatchRadar risque de ne pas fonctionner.";
  }
  if (!configuration || configuration.ready) return null;
  if (!configuration.jellyfinUrlConfigured) {
    return "L’URL Jellyfin n’est pas renseignée. Définissez JELLYFIN_URL dans .env puis redémarrez WatchRadar.";
  }
  if (!configuration.apiKeyConfigured) {
    return "La clé API n’est pas renseignée. Connectez-vous avec un administrateur Jellyfin puis enregistrez-la dans Administration. Le partage ne fonctionnera pas avant.";
  }
  return "La configuration Jellyfin est incomplète. WatchRadar risque de ne pas fonctionner.";
}
