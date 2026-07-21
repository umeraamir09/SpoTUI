import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
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

describe("theme settings frames", () => {
  for (const dimensions of [
    { width: 90, height: 26 },
    { width: 52, height: 16 },
  ] as const) {
    test(
      `${String(dimensions.width)}x${String(dimensions.height)}`,
      async () => {
        const harness = await testRender(
          <App
            authController={createAuthenticatedAuthController()}
            playbackController={createPlayingPlaybackController()}
            onQuit={() => undefined}
          />,
          { ...dimensions, kittyKeyboard: true },
        )
        destroyers.push(() => {
          harness.renderer.destroy()
        })
        await harness.renderOnce()
        act(() => {
          harness.mockInput.pressKey(",")
        })
        await harness.renderOnce()

        const frame = harness.captureCharFrame()
        expect(frame).toContain("THEME SETTINGS")
        expect(frame).toContain("WARM-PHOSPHOR")
        expect(frame).toContain("MIDNIGHT-BLUE")
        expect(frame).toMatchSnapshot()
      },
    )
  }
})
