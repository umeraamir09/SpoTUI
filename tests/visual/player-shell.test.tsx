import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { createAuthenticatedAuthController } from "../helpers/auth"
import { createInactivePlaybackController } from "../helpers/playback"

const TARGET_FRAMES = [
  { width: 140, height: 40 },
  { width: 110, height: 30 },
  { width: 90, height: 26 },
  { width: 72, height: 22 },
  { width: 52, height: 16 },
] as const

const destroyers: (() => void)[] = []

afterEach(() => {
  act(() => {
    for (const destroy of destroyers.splice(0)) {
      destroy()
    }
  })
})

describe("empty player shell frames", () => {
  for (const dimensions of TARGET_FRAMES) {
    test(
      `${String(dimensions.width)}x${String(dimensions.height)}`,
      async () => {
        const harness = await testRender(
          <App
            authController={createAuthenticatedAuthController()}
            playbackController={createInactivePlaybackController()}
            onQuit={() => undefined}
          />,
          dimensions,
        )
        destroyers.push(() => {
          harness.renderer.destroy()
        })

        await harness.renderOnce()

        const frame = harness.captureCharFrame()
        expect(frame).toMatchSnapshot()

        if (dimensions.width === 52) {
          expect(frame).toContain("COMPACT LAYOUT")
          expect(frame).toContain("NOTHING PLAYING")
        }
      },
    )
  }
})
