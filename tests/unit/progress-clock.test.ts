import { describe, expect, test } from "bun:test"

import {
  getInterpolatedProgressMs,
  reconcileProgressAnchor,
  type ProgressAnchor,
} from "../../src/playback/progress-clock"

describe("playback progress clock", () => {
  test("advances playing content locally and clamps to duration", () => {
    const anchor: ProgressAnchor = {
      durationMs: 10_000,
      isPlaying: true,
      itemKey: "track:one",
      receivedAtMs: 1_000,
      reportedProgressMs: 8_000,
      correctionFromMs: 0,
      correctionStartedAtMs: 1_000,
    }

    expect(getInterpolatedProgressMs(anchor, 1_500)).toBe(8_500)
    expect(getInterpolatedProgressMs(anchor, 5_000)).toBe(10_000)
  })

  test("does not advance paused content", () => {
    const anchor: ProgressAnchor = {
      durationMs: 10_000,
      isPlaying: false,
      itemKey: "track:one",
      receivedAtMs: 1_000,
      reportedProgressMs: 4_000,
      correctionFromMs: 0,
      correctionStartedAtMs: 1_000,
    }

    expect(getInterpolatedProgressMs(anchor, 9_000)).toBe(4_000)
  })

  test("reconciles a server correction without a visible jump", () => {
    const previous: ProgressAnchor = {
      durationMs: 20_000,
      isPlaying: true,
      itemKey: "track:one",
      receivedAtMs: 1_000,
      reportedProgressMs: 5_000,
      correctionFromMs: 0,
      correctionStartedAtMs: 1_000,
    }
    const corrected = reconcileProgressAnchor(
      previous,
      {
        durationMs: 20_000,
        isPlaying: true,
        itemKey: "track:one",
        progressMs: 5_500,
      },
      2_000,
    )

    expect(getInterpolatedProgressMs(corrected, 2_000)).toBe(6_000)
    expect(getInterpolatedProgressMs(corrected, 2_500)).toBe(6_000)
  })
})
