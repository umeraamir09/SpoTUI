import { describe, expect, mock, test } from "bun:test"

import { LyricsController } from "../../src/lyrics/lyrics-service"
import {
  getActiveLyricsLineIndex,
  getLyricsCacheKey,
  parseLrc,
} from "../../src/lyrics/normalize"
import { LrcLibProvider } from "../../src/lyrics/lrclib-provider"
import type { LyricsProvider } from "../../src/lyrics/types"
import { TEST_PLAYBACK } from "../helpers/playback"

describe("lyrics normalization", () => {
  test("normalizes cache identity and parses repeated LRC timestamps", () => {
    expect(getLyricsCacheKey({
      artist: "Beyoncé & The Unit",
      title: "Signal / One",
      album: "Night Signals",
      durationSeconds: 239.7,
      spotifyTrackId: null,
    })).toBe("beyonce-the-unit_signal-one_night-signals_240")
    const lines = parseLrc("[00:01.20][00:02.5] hello\n[01:03.007] there")
    expect(lines).toEqual([
      { atMs: 1_200, text: "hello" },
      { atMs: 2_500, text: "hello" },
      { atMs: 63_007, text: "there" },
    ])
    expect(getActiveLyricsLineIndex(lines, 2_499)).toBe(0)
    expect(getActiveLyricsLineIndex(lines, 2_500)).toBe(1)
  })
})

describe("LRCLIB provider", () => {
  test("prefers validated synced LRC over plain text and passes track identity", async () => {
    const fetch = mock((input: string | URL | Request) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      )
      expect(url.searchParams.get("track_name")).toBe("Warm Receiver")
      expect(url.searchParams.get("artist_name")).toBe("Signal Unit")
      return Promise.resolve(new Response(JSON.stringify({
        syncedLyrics: "[00:01.00] First line",
        plainLyrics: "Fallback text",
      })))
    })
    const provider = new LrcLibProvider({ fetch })
    const result = await provider.getLyrics({
      artist: "Signal Unit",
      title: "Warm Receiver",
      album: "Night Signals",
      durationSeconds: 240,
      spotifyTrackId: "track-one",
    })
    expect(result).toEqual({
      kind: "synced",
      lines: [{ atMs: 1_000, text: "First line" }],
      source: "LRCLIB",
    })
  })
})

describe("lyrics controller", () => {
  test("uses provider order, caches results, and isolates provider failures", async () => {
    const local: LyricsProvider = {
      id: "local",
      getLyrics: mock(() => Promise.resolve(null)),
    }
    const remote: LyricsProvider = {
      id: "remote",
      getLyrics: mock(() => Promise.resolve({ kind: "plain" as const, text: "words", source: "Test" })),
    }
    const controller = new LyricsController({ providers: [local, remote] })
    controller.load(TEST_PLAYBACK.item)
    await controller.whenIdle()
    expect(controller.getSnapshot()).toMatchObject({ status: "ready", result: { kind: "plain", text: "words" } })
    controller.load(TEST_PLAYBACK.item)
    expect(local.getLyrics).toHaveBeenCalledTimes(1)
    expect(remote.getLyrics).toHaveBeenCalledTimes(1)

    const failing = new LyricsController({
      providers: [{ id: "broken", getLyrics: () => Promise.reject(new Error("offline")) }],
    })
    failing.load(TEST_PLAYBACK.item)
    await failing.whenIdle()
    expect(failing.getSnapshot()).toMatchObject({ status: "unavailable", result: null })
  })

  test("abandons an old track response after a track change", async () => {
    let resolveFirst: ((value: { kind: "plain"; text: string; source: string } | null) => void) | undefined
    const provider: LyricsProvider = {
      id: "delayed",
      getLyrics: (track) => track.title === "Warm Receiver"
        ? new Promise((resolve) => { resolveFirst = resolve })
        : Promise.resolve({ kind: "plain", text: "new track", source: "Test" }),
    }
    const controller = new LyricsController({ providers: [provider] })
    const firstItem = TEST_PLAYBACK.item
    if (firstItem === null) throw new Error("Test playback item is required")
    controller.load(firstItem)
    controller.load({ ...firstItem, id: "track-two", title: "Next Signal" })
    await controller.whenIdle()
    resolveFirst?.({ kind: "plain", text: "old track", source: "Test" })
    await Promise.resolve()
    expect(controller.getSnapshot()).toMatchObject({ result: { text: "new track" } })
  })
})
