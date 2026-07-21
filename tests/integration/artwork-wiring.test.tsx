import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import type { ArtworkControllerPort } from "../../src/artwork/artwork-service"
import type {
  ArtworkRequest,
  ArtworkViewState,
} from "../../src/artwork/types"
import { createAuthenticatedAuthController } from "../helpers/auth"
import { createPlayingPlaybackController } from "../helpers/playback"

const destroyers: (() => void)[] = []

afterEach(() => {
  act(() => {
    for (const destroy of destroyers.splice(0)) {
      destroy()
    }
  })
})

describe("artwork application wiring", () => {
  test("requests a deck-filling frame for the current Spotify item", async () => {
    const recorded = createRecordingArtworkController()
    const harness = await testRender(
      <App
        artworkController={recorded.controller}
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        onQuit={() => undefined}
      />,
      { height: 40, width: 140 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    expect(recorded.requests.at(-1)).toEqual({
      animations: true,
      height: 27,
      isPlaying: true,
      key: "track:track-one",
      url: "https://i.scdn.co/image/cover-one",
      width: 54,
    })
  })

  test("does not fetch artwork when the no-art mode is active", async () => {
    const recorded = createRecordingArtworkController()
    const harness = await testRender(
      <App
        artworkController={recorded.controller}
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        uiOptions={{
          albumArt: false,
          animations: false,
          asciiArtwork: false,
          colorMode: "auto",
          themeFile: null,
          themePreset: "warm-phosphor",
          themePresetExplicit: false,
        }}
        onQuit={() => undefined}
      />,
      { height: 26, width: 90 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    expect(recorded.requests.at(-1)).toBeNull()
    expect(harness.captureCharFrame()).toContain(".----------.")
  })

  test("isolates animation updates from the playback UI subtree", async () => {
    const recorded = createRecordingArtworkController()
    const basePlayback = createPlayingPlaybackController()
    let playbackSnapshotReads = 0
    const playbackController = {
      ...basePlayback,
      getSnapshot: () => {
        playbackSnapshotReads += 1
        return basePlayback.getSnapshot()
      },
    }
    const harness = await testRender(
      <App
        artworkController={recorded.controller}
        authController={createAuthenticatedAuthController()}
        playbackController={playbackController}
        onQuit={() => undefined}
      />,
      { height: 26, width: 90 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()
    await harness.renderOnce()
    const readsBeforeArtworkTick = playbackSnapshotReads

    act(() => {
      recorded.publish({
        frame: null,
        message: null,
        rotating: true,
        sourceKey: "track:track-one",
        staticFrame: null,
        status: "loading",
      })
    })
    await harness.renderOnce()

    expect(playbackSnapshotReads).toBe(readsBeforeArtworkTick)
  })

  test("releases the visible artwork request outside the player page", async () => {
    const recorded = createRecordingArtworkController()
    const harness = await testRender(
      <App
        artworkController={recorded.controller}
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        onQuit={() => undefined}
      />,
      { height: 26, width: 90 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()
    expect(recorded.requests.at(-1)).not.toBeNull()

    act(() => {
      harness.mockInput.pressKey("b")
    })
    await harness.renderOnce()

    expect(recorded.requests.at(-1)).toBeNull()
  })
})

function createRecordingArtworkController(): {
  controller: ArtworkControllerPort
  publish: (state: ArtworkViewState) => void
  requests: (ArtworkRequest | null)[]
} {
  const requests: (ArtworkRequest | null)[] = []
  const listeners = new Set<() => void>()
  let state: ArtworkViewState = {
    frame: null,
    message: null,
    rotating: false,
    sourceKey: null,
    staticFrame: null,
    status: "idle",
  }
  return {
    controller: {
      getSnapshot: () => state,
      setArtwork: (request) => {
        requests.push(request)
      },
      setTerminalFocused: () => undefined,
      stop: () => undefined,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      whenIdle: () => Promise.resolve(),
    },
    publish: (nextState) => {
      state = nextState
      for (const listener of listeners) {
        listener()
      }
    },
    requests,
  }
}
