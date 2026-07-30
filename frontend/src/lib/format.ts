export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatEpisode(season: number | null, episode: number | null): string {
  if (season === null && episode === null) return "";
  return `S${String(season ?? 0).padStart(2, "0")} · E${String(episode ?? 0).padStart(2, "0")}`;
}

export function formatDuration(ticksString: string): string {
  const ticks = Number(ticksString);
  if (!Number.isFinite(ticks)) return "0 min";
  const totalMinutes = Math.floor(ticks / 10_000_000 / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} h ${minutes.toString().padStart(2, "0")}` : `${minutes} min`;
}
