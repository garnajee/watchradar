import type { Response } from "express";
import { appEvents } from "../events.js";
import { getDashboardUser } from "./activity.js";

const MAX_CONNECTIONS_PER_VIEWER = 4;
const MAX_CONNECTIONS_TOTAL = 100;
const MAX_BUFFERED_BYTES = 256 * 1024;
const HEARTBEAT_INTERVAL_MS = 20_000;
const EVENT_COALESCE_MS = 100;

type StreamClient = {
  viewerId: number;
  response: Response;
  close: () => void;
};

export class DashboardStreamHub {
  private readonly clientsByViewer = new Map<number, Set<StreamClient>>();
  private readonly pendingTargetIds = new Set<number>();
  private totalConnections = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private flushTimer: NodeJS.Timeout | null = null;

  canConnect(viewerId: number): boolean {
    return (
      this.totalConnections < MAX_CONNECTIONS_TOTAL &&
      (this.clientsByViewer.get(viewerId)?.size ?? 0) < MAX_CONNECTIONS_PER_VIEWER
    );
  }

  connect(viewerId: number, response: Response): () => void {
    const clients = this.clientsByViewer.get(viewerId) ?? new Set<StreamClient>();
    this.clientsByViewer.set(viewerId, clients);

    let closed = false;
    const client: StreamClient = {
      viewerId,
      response,
      close: () => {
        if (closed) return;
        closed = true;
        clients.delete(client);
        this.totalConnections -= 1;
        response.off("close", client.close);
        response.off("error", client.close);
        if (clients.size === 0) this.clientsByViewer.delete(viewerId);
        if (this.totalConnections === 0) this.stopListening();
      }
    };
    clients.add(client);
    this.totalConnections += 1;
    response.once("close", client.close);
    response.once("error", client.close);
    this.startListening();
    this.write(client, `event: connected\ndata: ${JSON.stringify({ connected: true })}\n\n`);
    return client.close;
  }

  private startListening(): void {
    if (this.heartbeatTimer) return;
    appEvents.on("playback:changed", this.onPlayback);
    this.heartbeatTimer = setInterval(() => {
      this.forEachClient((client) => this.write(client, ": heartbeat\n\n"));
    }, HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref();
  }

  private stopListening(): void {
    appEvents.off("playback:changed", this.onPlayback);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.heartbeatTimer = null;
    this.flushTimer = null;
    this.pendingTargetIds.clear();
  }

  private readonly onPlayback = (targetId: number): void => {
    if (!Number.isInteger(targetId) || targetId <= 0) return;
    this.pendingTargetIds.add(targetId);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushPlaybackChanges();
    }, EVENT_COALESCE_MS);
    this.flushTimer.unref();
  };

  private async flushPlaybackChanges(): Promise<void> {
    const targetIds = [...this.pendingTargetIds];
    this.pendingTargetIds.clear();
    const viewerIds = [...this.clientsByViewer.keys()];
    await Promise.allSettled(
      targetIds.flatMap((targetId) =>
        viewerIds.map(async (viewerId) => {
          const user = await getDashboardUser(viewerId, targetId);
          if (!user) return;
          const payload = `event: playback\ndata: ${JSON.stringify(user)}\n\n`;
          for (const client of this.clientsByViewer.get(viewerId) ?? []) {
            this.write(client, payload);
          }
        })
      )
    );
  }

  private forEachClient(callback: (client: StreamClient) => void): void {
    for (const clients of this.clientsByViewer.values()) {
      for (const client of clients) callback(client);
    }
  }

  private write(client: StreamClient, payload: string): void {
    const { response } = client;
    if (
      response.destroyed ||
      response.writableEnded ||
      response.writableLength > MAX_BUFFERED_BYTES
    ) {
      client.close();
      response.destroy();
      return;
    }
    response.write(payload);
  }
}

export const dashboardStreamHub = new DashboardStreamHub();
