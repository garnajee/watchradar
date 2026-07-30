export function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-night text-ink">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-violet/20 border-t-violet" />
        <p className="text-sm text-muted">WatchRadar se synchronise…</p>
      </div>
    </div>
  );
}
