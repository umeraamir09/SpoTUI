import { describe, expect, mock, test } from "bun:test"

import {
  PlaybackController,
  type PlaybackRemote,
} from "../../src/playback/playback-controller"
import type {
  PlaybackDevice,
  PlaybackSnapshot,
} from "../../src/playback/types"

const ACTIVE_DEVICE: PlaybackDevice = {
  id: "device-active",
  isActive: true,
  isPrivateSession: false,
  isRestricted: false,
  name: "Desk Speaker",
  supportsVolume: true,
  type: "speaker",
  volumePercent: 60,
}

const PLAYING: PlaybackSnapshot = {
  device: ACTIVE_DEVICE,
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
  progressMs: 30_000,
  repeatState: "off",
  shuffleState: false,
  timestamp: 1_000,
}

describe("PlaybackController", () => {
  test("loads playback and devices, then applies optimistic play/pause", async () => {
    const pause = mock(() => Promise.resolve())
    const controller = new PlaybackController({
      remote: createRemote({ pause }),
      now: () => 10_000,
    })

    await controller.refresh()
    controller.togglePlayback()
    await controller.whenIdle()

    expect(controller.getSnapshot().status).toBe("ready")
    expect(controller.getSnapshot().playback?.isPlaying).toBe(false)
    expect(pause).toHaveBeenCalledWith("device-active", undefined)
  })

  test("explains restricted-device commands instead of sending them", async () => {
    const pause = mock(() => Promise.resolve())
    const controller = new PlaybackController({
      remote: createRemote({
        getPlaybackState: () =>
          Promise.resolve({
            ...PLAYING,
            device: {
              ...ACTIVE_DEVICE,
              isRestricted: true,
            },
          }),
        pause,
      }),
    })

    await controller.refresh()
    controller.togglePlayback()
    await controller.whenIdle()

    expect(pause).not.toHaveBeenCalled()
    expect(controller.getSnapshot().notice?.kind).toBe(
      "restricted-device",
    )
  })

  test("shows device selection when playback has no active device", async () => {
    const available = {
      ...ACTIVE_DEVICE,
      id: "device-available",
      isActive: false,
    }
    const controller = new PlaybackController({
      remote: createRemote({
        getPlaybackState: () => Promise.resolve(null),
        getDevices: () => Promise.resolve([available]),
      }),
    })

    await controller.refresh()

    expect(controller.getSnapshot().status).toBe("no-device")
    expect(controller.getSnapshot().devices).toEqual([available])
  })

  test("transfers to an unrestricted available device", async () => {
    const transferPlayback = mock(() => Promise.resolve())
    const available = {
      ...ACTIVE_DEVICE,
      id: "device-other",
      isActive: false,
      name: "Phone",
    }
    const controller = new PlaybackController({
      remote: createRemote({
        getDevices: () =>
          Promise.resolve([ACTIVE_DEVICE, available]),
        transferPlayback,
      }),
    })

    await controller.refresh()
    controller.transferTo("device-other", true)
    await controller.whenIdle()

    expect(transferPlayback).toHaveBeenCalledWith(
      "device-other",
      true,
      undefined,
    )
    expect(
      controller
        .getSnapshot()
        .devices.find((device) => device.id === "device-other")
        ?.isActive,
    ).toBe(true)
  })

  test("schedules an authoritative refresh 400ms after a command", async () => {
    const scheduled: {
      callback: () => void
      milliseconds: number
    }[] = []
    let playbackReads = 0
    const controller = new PlaybackController({
      remote: createRemote({
        getPlaybackState: () => {
          playbackReads += 1
          return Promise.resolve(PLAYING)
        },
      }),
      setTimer: (callback, milliseconds) => {
        scheduled.push({ callback, milliseconds })
        return 1 as unknown as ReturnType<typeof setTimeout>
      },
      clearTimer: () => undefined,
    })

    controller.start()
    await controller.whenIdle()
    controller.togglePlayback()
    await controller.whenIdle()

    const commandRefresh = scheduled.at(-1)
    expect(commandRefresh?.milliseconds).toBe(400)
    commandRefresh?.callback()
    await controller.whenIdle()
    expect(playbackReads).toBe(2)
    controller.stop()
  })

  test("starts a later command without waiting for an earlier request", async () => {
    let resolvePause: (() => void) | undefined
    const pause = mock(
      () =>
        new Promise<void>((resolve) => {
          resolvePause = resolve
        }),
    )
    const next = mock(() => Promise.resolve())
    const controller = new PlaybackController({
      remote: createRemote({ next, pause }),
    })

    await controller.refresh()
    controller.togglePlayback()
    controller.next()
    await Promise.resolve()
    await Promise.resolve()

    expect(pause).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().pendingCommand).toBeNull()

    resolvePause?.()
    await controller.whenIdle()
  })

  test("seeks to an absolute dragged position and clamps it to the item", async () => {
    const seek = mock(() => Promise.resolve())
    const controller = new PlaybackController({
      remote: createRemote({ seek }),
      now: () => 10_000,
    })

    await controller.refresh()
    controller.seekTo(999_999)
    await controller.whenIdle()

    expect(controller.getSnapshot().playback?.progressMs).toBe(240_000)
    expect(seek).toHaveBeenCalledWith(
      240_000,
      "device-active",
      undefined,
    )
  })
})

function createRemote(
  overrides: Partial<PlaybackRemote> = {},
): PlaybackRemote {
  return {
    getPlaybackState: () => Promise.resolve(PLAYING),
    getDevices: () => Promise.resolve([ACTIVE_DEVICE]),
    play: () => Promise.resolve(),
    pause: () => Promise.resolve(),
    next: () => Promise.resolve(),
    previous: () => Promise.resolve(),
    seek: () => Promise.resolve(),
    setVolume: () => Promise.resolve(),
    setShuffle: () => Promise.resolve(),
    setRepeat: () => Promise.resolve(),
    transferPlayback: () => Promise.resolve(),
    ...overrides,
  }
}
