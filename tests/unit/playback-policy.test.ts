import { describe, expect, test } from "bun:test"

import {
  cycleRepeatState,
  getPollIntervalMs,
  resolveMuteToggle,
} from "../../src/playback/playback-policy"

describe("playback policy", () => {
  test("cycles repeat off, context, track, then off", () => {
    expect(cycleRepeatState("off")).toBe("context")
    expect(cycleRepeatState("context")).toBe("track")
    expect(cycleRepeatState("track")).toBe("off")
  })

  test("remembers the previous audible volume across mute", () => {
    expect(resolveMuteToggle(72, 50)).toEqual({
      rememberedVolume: 72,
      volume: 0,
    })
    expect(resolveMuteToggle(0, 72)).toEqual({
      rememberedVolume: 72,
      volume: 72,
    })
  })

  test("uses adaptive focused and background polling cadences", () => {
    expect(getPollIntervalMs("playing", true)).toBe(3_000)
    expect(getPollIntervalMs("playing", false)).toBe(8_000)
    expect(getPollIntervalMs("paused", true)).toBe(9_000)
    expect(getPollIntervalMs("inactive", true)).toBe(15_000)
  })
})
