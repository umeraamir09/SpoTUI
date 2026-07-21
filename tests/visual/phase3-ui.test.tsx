import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { createStaticPlaybackController } from "../../src/playback/playback-controller"
import { createAuthenticatedAuthController } from "../helpers/auth"
import {
  TEST_PLAYBACK,
  TEST_PLAYING_STATE,
} from "../helpers/playback"

const destroyers: (() => void)[] = []

afterEach(() => {
  act(() => {
    for (const destroy of destroyers.splice(0)) {
      destroy()
    }
  })
})

describe("Phase 3 interaction frames", () => {
  test("offline stale playback promotes a visible error toast", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createStaticPlaybackController({
          ...TEST_PLAYING_STATE,
          notice: {
            kind: "network",
            message:
              "Spotify is offline. Showing the last known playback state.",
          },
          playback: {
            ...TEST_PLAYBACK,
            isPlaying: false,
          },
          progress:
            TEST_PLAYING_STATE.progress === null
              ? null
              : {
                  ...TEST_PLAYING_STATE.progress,
                  isPlaying: false,
                },
          stale: true,
        })}
        onQuit={() => undefined}
      />,
      { height: 26, width: 90 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })

    await harness.renderOnce()
    await harness.renderOnce()

    const frame = harness.captureCharFrame()
    expect(frame).toContain("CONNECTION ERROR")
    expect(frame).toContain("FOCUS TRANSPORT / STALE")
    expect(frame).toMatchSnapshot()
  })

  test("device picker remains coherent as a focused modal surface", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createStaticPlaybackController(
          TEST_PLAYING_STATE,
        )}
        onQuit={() => undefined}
      />,
      { height: 26, width: 90, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })

    await harness.renderOnce()
    act(() => {
      harness.mockInput.pressKey("d")
    })
    await harness.renderOnce()

    const frame = harness.captureCharFrame()
    expect(frame).toContain("CHOOSE SPOTIFY DEVICE")
    expect(frame).toMatchSnapshot()
  })
})
