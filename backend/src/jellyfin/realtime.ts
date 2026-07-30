import WebSocket from "ws";
import type { PlaybackState, Prisma } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { appEvents } from "../events.js";
import { logger } from "../logger.js";
import { getConfiguredJellyfinClient } from "./configured-client.js";
import type { JellyfinSession } from "./types.js";

const POLL_INTERVAL_MS = 30_000;
const RECONNECT_DELAY_MS = 10_000;
const MIN_POLL_INTERVAL_MS = 2_000;

export function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/([?&]api_key=)[^&\s]+/gi, "$1[redacted]");
}

export class JellyfinRealtime {
  private socket: WebSocket | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private pollDelayTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pollPromise: Promise<void> | null = null;
  private pollQueued = false;
  private started = false;
  private stopped = false;
  private connectionGeneration = 0;
  private lastPollStartedAt = 0;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.stopped = false;
    appEvents.on("jellyfin:config-changed", this.restart);
    void this.connect();
    this.pollTimer = setInterval(() => this.queuePoll(), POLL_INTERVAL_MS);
    this.pollTimer.unref();
    this.queuePoll();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.stopped = true;
    appEvents.off("jellyfin:config-changed", this.restart);
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.pollDelayTimer) clearTimeout(this.pollDelayTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.pollTimer = null;
    this.pollDelayTimer = null;
    this.reconnectTimer = null;
    this.pollQueued = false;
    this.connectionGeneration += 1;
    const socket = this.socket;
    this.socket = null;
    socket?.removeAllListeners();
    socket?.close();
  }

  private readonly restart = (): void => {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.removeAllListeners();
    socket?.close();
    void this.connect();
    this.queuePoll();
  };

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, RECONNECT_DELAY_MS);
    this.reconnectTimer.unref();
  }

  private async connect(): Promise<void> {
    const generation = ++this.connectionGeneration;
    try {
      const { url, apiKey } = await getConfiguredJellyfinClient();
      if (this.stopped || generation !== this.connectionGeneration) return;
      const socketUrl = new URL(url);
      socketUrl.protocol = "wss:";
      socketUrl.pathname = `${socketUrl.pathname.replace(/\/$/, "")}/socket`;
      socketUrl.searchParams.set("api_key", apiKey);
      socketUrl.searchParams.set("deviceId", "watchradar-backend");

      this.socket?.removeAllListeners();
      this.socket?.close();
      const socket = new WebSocket(socketUrl, {
        rejectUnauthorized: config.jellyfinTlsRejectUnauthorized
      });
      if (this.stopped || generation !== this.connectionGeneration) {
        socket.close();
        return;
      }
      this.socket = socket;

      socket.on("open", () => {
        logger.info("Connected to Jellyfin WebSocket");
        socket.send(JSON.stringify({ MessageType: "SessionsStart", Data: "0,1500" }));
      });
      socket.on("message", (raw) => {
        try {
          const message = JSON.parse(raw.toString()) as { MessageType?: string; Data?: unknown };
          if (message.MessageType === "Sessions" && Array.isArray(message.Data)) {
            void this.syncSessions(message.Data as JellyfinSession[]);
          } else if (
            message.MessageType &&
            ["PlaybackStart", "PlaybackProgress", "PlaybackStopped", "SessionEnded"].includes(
              message.MessageType
            )
          ) {
            this.queuePoll();
          }
        } catch (error) {
          logger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            "Ignored malformed Jellyfin WebSocket message"
          );
        }
      });
      socket.on("error", (error) => {
        logger.warn(
          { error: safeErrorMessage(error) },
          "Jellyfin WebSocket error; polling remains active"
        );
      });
      socket.on("close", () => {
        if (this.socket === socket) this.socket = null;
        this.scheduleReconnect();
      });
    } catch (error) {
      logger.debug(
        { error: safeErrorMessage(error) },
        "Jellyfin WebSocket not ready"
      );
      this.scheduleReconnect();
    }
  }

  private queuePoll(): void {
    if (this.stopped) return;
    if (this.pollPromise) {
      this.pollQueued = true;
      return;
    }
    const delay = MIN_POLL_INTERVAL_MS - (Date.now() - this.lastPollStartedAt);
    if (delay > 0) {
      if (!this.pollDelayTimer) {
        this.pollDelayTimer = setTimeout(() => {
          this.pollDelayTimer = null;
          this.queuePoll();
        }, delay);
        this.pollDelayTimer.unref();
      }
      return;
    }
    this.lastPollStartedAt = Date.now();
    this.pollPromise = this.poll()
      .catch((error: unknown) => {
        logger.debug(
          { error: safeErrorMessage(error) },
          "Jellyfin session poll skipped"
        );
      })
      .finally(() => {
        this.pollPromise = null;
        if (this.pollQueued && !this.stopped) {
          this.pollQueued = false;
          this.queuePoll();
        }
      });
  }

  private async poll(): Promise<void> {
    const { client } = await getConfiguredJellyfinClient();
    await this.syncSessions(await client.getSessions());
  }

  private async syncSessions(sessions: JellyfinSession[]): Promise<void> {
    const activeByJellyfinUser = new Map<string, JellyfinSession>();
    for (const session of sessions) {
      if (session.UserId && session.NowPlayingItem) {
        activeByJellyfinUser.set(session.UserId, session);
      }
    }

    const users = await prisma.siteUser.findMany({
      select: { id: true, jellyfinUserId: true, playbackState: true }
    });
    const updates: Prisma.PrismaPromise<PlaybackState>[] = [];
    const changedUserIds: number[] = [];
    for (const user of users) {
      const session = activeByJellyfinUser.get(user.jellyfinUserId);
      const item = session?.NowPlayingItem;
      const desired = item
        ? {
            itemId: item.Id,
            itemName: item.Name,
            itemType: item.Type,
            seriesId: item.SeriesId ?? null,
            seriesName: item.SeriesName ?? null,
            seasonNumber: item.ParentIndexNumber ?? null,
            episodeNumber: item.IndexNumber ?? null,
            imageTag: item.ImageTags?.Primary ?? null,
            positionTicks: BigInt(session.PlayState?.PositionTicks ?? 0),
            runtimeTicks: BigInt(item.RunTimeTicks ?? 0),
            isPlaying: !session.PlayState?.IsPaused
          }
        : {
            itemId: null,
            itemName: null,
            itemType: null,
            seriesId: null,
            seriesName: null,
            seasonNumber: null,
            episodeNumber: null,
            imageTag: null,
            positionTicks: null,
            runtimeTicks: null,
            isPlaying: false
          };
      if (playbackMatches(user.playbackState, desired)) continue;
      updates.push(
        prisma.playbackState.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            ...desired
          },
          update: desired
        })
      );
      changedUserIds.push(user.id);
    }
    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }
    for (const userId of changedUserIds) {
      appEvents.emit("playback:changed", userId);
    }
  }
}

type PlaybackSnapshot = Omit<
  Prisma.PlaybackStateUncheckedCreateInput,
  "id" | "userId" | "lastUpdated"
>;

function playbackMatches(
  current: PlaybackState | null,
  desired: PlaybackSnapshot
): boolean {
  if (!current) return false;
  return (
    current.itemId === desired.itemId &&
    current.itemName === desired.itemName &&
    current.itemType === desired.itemType &&
    current.seriesId === desired.seriesId &&
    current.seriesName === desired.seriesName &&
    current.seasonNumber === desired.seasonNumber &&
    current.episodeNumber === desired.episodeNumber &&
    current.imageTag === desired.imageTag &&
    current.positionTicks === desired.positionTicks &&
    current.runtimeTicks === desired.runtimeTicks &&
    current.isPlaying === desired.isPlaying
  );
}
