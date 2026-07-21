import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { createStaticArtworkController } from "../../src/artwork/artwork-service"
import {
  createStaticPlaybackController,
  type PlaybackControllerPort,
} from "../../src/playback/playback-controller"
import { createAuthenticatedAuthController } from "../helpers/auth"
import { TEST_PLAYING_STATE } from "../helpers/playback"

const destroyers: (() => void)[] = []

afterEach(() => {
  act(() => {
    for (const destroy of destroyers.splice(0)) {
      destroy()
    }
  })
})

describe("artwork input isolation", () => {
  test("playback keys remain active while artwork processing is pending", async () => {
    let toggles = 0
    const base = createStaticPlaybackController(TEST_PLAYING_STATE)
    const playbackController: PlaybackControllerPort = {
      ...base,
      togglePlayback: () => {
        toggles += 1
      },
    }
    const harness = await testRender(
      <App
        artworkController={createStaticArtworkController({
          frame: null,
          message: null,
          rotating: false,
          sourceKey: "track:track-one",
          staticFrame: null,
          status: "loading",
        })}
        authController={createAuthenticatedAuthController()}
        playbackController={playbackController}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressKey(" ")
    })
    await harness.renderOnce()

    expect(toggles).toBe(1)
  })
})
