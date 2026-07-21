import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { createStaticPlaybackController } from "../../src/playback/playback-controller"
import { createAuthenticatedAuthController } from "../helpers/auth"
import {
  TEST_ACTIVE_DEVICE,
  TEST_PLAYING_STATE,
} from "../helpers/playback"

const destroyers: (() => void)[] = []
const PLAYING_DIMENSIONS = [
  { width: 140, height: 40 },
  { width: 110, height: 30 },
  { width: 90, height: 26 },
  { width: 72, height: 22 },
  { width: 52, height: 16 },
] as const

afterEach(() => {
  act(() => {
    for (const destroy of destroyers.splice(0)) {
      destroy()
    }
  })
})

describe("Phase 2 playback frames", () => {
  for (const dimensions of PLAYING_DIMENSIONS) {
    test(
      `playing ${String(dimensions.width)}x${String(dimensions.height)}`,
      async () => {
        const harness = await testRender(
          <App
            authController={createAuthenticatedAuthController()}
            playbackController={createStaticPlaybackController(
              TEST_PLAYING_STATE,
            )}
            onQuit={() => undefined}
          />,
          dimensions,
        )
        destroyers.push(() => {
          harness.renderer.destroy()
        })
        await harness.renderOnce()

        expect(harness.captureCharFrame()).toMatchSnapshot()
      },
    )
  }

  test("no-device", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createStaticPlaybackController({
          status: "no-device",
          playback: null,
          devices: [
            {
              ...TEST_ACTIVE_DEVICE,
              id: "available-device",
              isActive: false,
              name: "Living Room",
            },
          ],
          progress: null,
          stale: false,
          notice: {
            kind: "no-device",
            message:
              "Open Spotify on a device, or choose an available device.",
          },
          pendingCommand: null,
        })}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    expect(harness.captureCharFrame()).toMatchSnapshot()
  })
})
