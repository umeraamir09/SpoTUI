import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { createStaticDiscoveryController } from "../../src/discovery/discovery-controller"
import { createAuthenticatedAuthController } from "../helpers/auth"
import { TEST_DISCOVERY_STATE } from "../helpers/discovery"
import { createPlayingPlaybackController } from "../helpers/playback"

const destroyers: (() => void)[] = []

afterEach(() => {
  act(() => {
    for (const destroy of destroyers.splice(0)) {
      destroy()
    }
  })
})

describe("Phase 4 discovery frames", () => {
  test.each([
    ["search 90x26", "/", 90, 26, "SEARCH SPOTIFY TRACKS"],
    ["search 52x16", "/", 52, 16, "SEARCH SPOTIFY TRACKS"],
    ["browse 90x26", "g", 90, 26, "CATALOG DISCOVERY"],
    ["queue 90x26", "u", 90, 26, "PLAYBACK QUEUE"],
    ["queue 52x16", "u", 52, 16, "PLAYBACK QUEUE"],
    ["library 90x26", "b", 90, 26, "SPOTIFY LIBRARY"],
    ["library 52x16", "b", 52, 16, "SPOTIFY LIBRARY"],
  ])("%s", async (_name, key, width, height, expected) => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        discoveryController={createStaticDiscoveryController(
          TEST_DISCOVERY_STATE,
        )}
        onQuit={() => undefined}
      />,
      { width, height, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()
    act(() => {
      harness.mockInput.pressKey(key)
    })
    await harness.renderOnce()

    const frame = harness.captureCharFrame()
    expect(frame).toContain(expected)
    expect(frame).toMatchSnapshot()
  })
})
