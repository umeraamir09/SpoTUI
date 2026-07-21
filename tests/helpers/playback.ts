import {
  createStaticPlaybackController,
  type PlaybackControllerPort,
  type PlaybackViewState,
} from "../../src/playback/playback-controller"
import type {
  PlaybackDevice,
  PlaybackSnapshot,
} from "../../src/playback/types"

export const TEST_ACTIVE_DEVICE: PlaybackDevice = {
  id: "device-active",
  isActive: true,
  isPrivateSession: false,
  isRestricted: false,
  name: "Desk Speaker",
  supportsVolume: true,
  type: "speaker",
  volumePercent: 68,
}

export const TEST_PLAYBACK: PlaybackSnapshot = {
  device: TEST_ACTIVE_DEVICE,
  isPlaying: true,
  item: {
    album: "Night Signals",
    artists: ["Signal Unit"],
    durationMs: 240_000,
    id: "track-one",
    imageUrl: "https://i.scdn.co/image/cover-one",
    isLocal: false,
    kind: "track",
    title: "Warm Receiver",
    uri: "spotify:track:one",
  },
  progressMs: 64_000,
  repeatState: "context",
  shuffleState: true,
  timestamp: 1_000,
}

export const TEST_PLAYING_STATE: PlaybackViewState = {
  status: "ready",
  playback: TEST_PLAYBACK,
  devices: [
    TEST_ACTIVE_DEVICE,
    {
      ...TEST_ACTIVE_DEVICE,
      id: "device-phone",
      isActive: false,
      name: "Phone",
      type: "smartphone",
      volumePercent: 42,
    },
  ],
  progress: {
    correctionFromMs: 0,
    correctionStartedAtMs: 10_000,
    durationMs: 240_000,
    isPlaying: true,
    itemKey: "track:track-one",
    receivedAtMs: 10_000,
    reportedProgressMs: 64_000,
  },
  stale: false,
  notice: null,
  pendingCommand: null,
}

export function createPlayingPlaybackController(): PlaybackControllerPort {
  return createStaticPlaybackController(TEST_PLAYING_STATE)
}

export function createInactivePlaybackController(): PlaybackControllerPort {
  return createStaticPlaybackController({
    status: "nothing-playing",
    playback: null,
    devices: [TEST_ACTIVE_DEVICE],
    progress: null,
    stale: false,
    notice: null,
    pendingCommand: null,
  })
}
