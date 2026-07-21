import { afterEach, describe, expect, mock, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { createStaticDiscoveryController } from "../../src/discovery/discovery-controller"
import { createStaticPlaybackController } from "../../src/playback/playback-controller"
import { createAuthenticatedAuthController } from "../helpers/auth"
import {
  TEST_DISCOVERY_STATE,
} from "../helpers/discovery"
import {
  createPlayingPlaybackController,
} from "../helpers/playback"

const destroyers: (() => void)[] = []

afterEach(() => {
  act(() => {
    for (const destroy of destroyers.splice(0)) {
      destroy()
    }
  })
})

describe("Phase 4 discovery keymap", () => {
  test("opens search, moves focus out of text input, and queues a result", async () => {
    const playItem = mock(() => Promise.resolve(true))
    const queueItem = mock(() => Promise.resolve(true))
    const discoveryController = {
      ...createStaticDiscoveryController(TEST_DISCOVERY_STATE),
      playItem,
      queueItem,
    }
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        discoveryController={discoveryController}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressKey("/")
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain(
      "SEARCH SPOTIFY TRACKS",
    )

    act(() => {
      harness.mockInput.pressArrow("down")
    })
    await harness.renderOnce()
    act(() => {
      harness.mockInput.pressEnter()
    })

    expect(queueItem).toHaveBeenCalledWith(
      TEST_DISCOVERY_STATE.search.page.items[0],
      "device-active",
    )
    expect(playItem).not.toHaveBeenCalled()
  })

  test("opens queue and library without leaking player shortcuts", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        discoveryController={createStaticDiscoveryController(
          TEST_DISCOVERY_STATE,
        )}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressKey("u")
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("PLAYBACK QUEUE")
    act(() => {
      harness.mockInput.pressEscape()
    })
    await harness.renderOnce()
    act(() => {
      harness.mockInput.pressKey("b")
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("SPOTIFY LIBRARY")
    expect(harness.captureCharFrame()).toContain("LIKED SONGS")
    expect(harness.captureCharFrame()).toContain("PLAYLISTS")
  })

  test("refreshes the queue whenever a visible queue surface opens", async () => {
    const refreshQueue = mock(() => Promise.resolve())
    const discoveryController = {
      ...createStaticDiscoveryController(TEST_DISCOVERY_STATE),
      refreshQueue,
    }
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        discoveryController={discoveryController}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()
    expect(refreshQueue).toHaveBeenCalledTimes(1)

    act(() => {
      harness.mockInput.pressKey("u")
    })
    await harness.renderOnce()
    expect(refreshQueue).toHaveBeenCalledTimes(2)
  })

  test("opens the browse page and returns through in-app history", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        discoveryController={createStaticDiscoveryController(
          TEST_DISCOVERY_STATE,
        )}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressKey("g")
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("BROWSE")
    expect(harness.captureCharFrame()).toContain("CATALOG DISCOVERY")

    act(() => {
      harness.mockInput.pressEscape()
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("Warm Receiver")
  })

  test("routes play-now to device selection when no device is active", async () => {
    const playItem = mock(() => Promise.resolve(true))
    const discoveryController = {
      ...createStaticDiscoveryController(TEST_DISCOVERY_STATE),
      playItem,
    }
    const playbackController = createStaticPlaybackController({
      status: "no-device",
      playback: null,
      devices: [
        {
          id: "available-device",
          isActive: false,
          isPrivateSession: false,
          isRestricted: false,
          name: "Available Speaker",
          supportsVolume: true,
          type: "speaker",
          volumePercent: 50,
        },
      ],
      progress: null,
      stale: false,
      notice: null,
      pendingCommand: null,
    })
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={playbackController}
        discoveryController={discoveryController}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()
    act(() => {
      harness.mockInput.pressKey("/")
    })
    await harness.renderOnce()
    act(() => {
      harness.mockInput.pressArrow("down")
    })
    await harness.renderOnce()
    act(() => {
      harness.mockInput.pressEnter()
    })
    await harness.renderOnce()

    expect(playItem).not.toHaveBeenCalled()
    expect(harness.captureCharFrame()).toContain(
      "CHOOSE SPOTIFY DEVICE",
    )
  })

  test("offers in-app reauthorization when library scopes are missing", async () => {
    const reauthorize = mock(() => undefined)
    const authController = {
      ...createAuthenticatedAuthController(),
      reauthorize,
    }
    const discoveryController = createStaticDiscoveryController({
      ...TEST_DISCOVERY_STATE,
      library: {
        ...TEST_DISCOVERY_STATE.library,
        status: "error",
        error:
          "Spotify denied this action. Reconnect if library or playlist permissions changed.",
      },
    })
    const harness = await testRender(
      <App
        authController={authController}
        playbackController={createPlayingPlaybackController()}
        discoveryController={discoveryController}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()
    act(() => {
      harness.mockInput.pressKey("b")
    })
    await harness.renderOnce()

    expect(harness.captureCharFrame()).toContain(
      "REAUTHORIZE SPOTIFY",
    )
    act(() => {
      harness.mockInput.pressKey("r", { shift: true })
    })

    expect(reauthorize).toHaveBeenCalledTimes(1)
  })
})
