import type { RepeatState } from "./types"

export type PollingPlaybackState =
  | "playing"
  | "paused"
  | "inactive"

export function cycleRepeatState(
  current: RepeatState,
): RepeatState {
  switch (current) {
    case "off":
      return "context"
    case "context":
      return "track"
    case "track":
      return "off"
  }
}

export function resolveMuteToggle(
  currentVolume: number,
  rememberedVolume: number,
): {
  volume: number
  rememberedVolume: number
} {
  if (currentVolume > 0) {
    return {
      volume: 0,
      rememberedVolume: currentVolume,
    }
  }

  return {
    volume: Math.max(1, rememberedVolume),
    rememberedVolume: Math.max(1, rememberedVolume),
  }
}

export function getPollIntervalMs(
  state: PollingPlaybackState,
  terminalFocused: boolean,
): number {
  if (state === "playing") {
    return terminalFocused ? 3_000 : 8_000
  }

  if (state === "paused") {
    return 9_000
  }

  return 15_000
}
