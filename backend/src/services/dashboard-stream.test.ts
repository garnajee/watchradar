import { EventEmitter } from "node:events";
import type { Response } from "express";
import { afterEach, describe, expect, it } from "vitest";
import { appEvents } from "../events.js";
import { DashboardStreamHub } from "./dashboard-stream.js";

class FakeResponse extends EventEmitter {
  destroyed = false;
  writableEnded = false;
  writableLength = 0;
  readonly writes: string[] = [];

  write(payload: string): boolean {
    this.writes.push(payload);
    return true;
  }

  destroy(): this {
    if (this.destroyed) return this;
    this.destroyed = true;
    this.emit("close");
    return this;
  }
}

const openStreams: Array<() => void> = [];

afterEach(() => {
  for (const close of openStreams.splice(0)) close();
});

describe("DashboardStreamHub", () => {
  it("uses one shared event listener and releases it after the last client", () => {
    const baselineListeners = appEvents.listenerCount("playback:changed");
    const hub = new DashboardStreamHub();

    for (let index = 0; index < 4; index += 1) {
      expect(hub.canConnect(42)).toBe(true);
      const response = new FakeResponse();
      openStreams.push(hub.connect(42, response as unknown as Response));
      expect(response.writes[0]).toContain("event: connected");
    }

    expect(hub.canConnect(42)).toBe(false);
    expect(appEvents.listenerCount("playback:changed")).toBe(baselineListeners + 1);

    for (const close of openStreams.splice(0)) close();
    expect(appEvents.listenerCount("playback:changed")).toBe(baselineListeners);
  });

  it("drops a slow client instead of growing its output buffer", () => {
    const baselineListeners = appEvents.listenerCount("playback:changed");
    const hub = new DashboardStreamHub();
    const response = new FakeResponse();
    response.writableLength = 256 * 1024 + 1;

    hub.connect(7, response as unknown as Response);

    expect(response.destroyed).toBe(true);
    expect(response.writes).toHaveLength(0);
    expect(appEvents.listenerCount("playback:changed")).toBe(baselineListeners);
  });
});
