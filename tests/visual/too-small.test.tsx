import { afterEach, describe, expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { theme } from "../../src/ui/theme/theme"
import { createAuthenticatedAuthController } from "../helpers/auth"
import { createInactivePlaybackController } from "../helpers/playback"

const destroyers: (() => void)[] = []

afterEach(() => {
  act(() => {
    for (const destroy of destroyers.splice(0)) {
      destroy()
    }
  })
})

describe("too-small state", () => {
  test("renders an explicit recovery message with error styling", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createInactivePlaybackController()}
        onQuit={() => undefined}
      />,
      {
        width: 51,
        height: 15,
      },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })

    await harness.renderOnce()

    const frame = harness.captureCharFrame()
    const spans = harness.captureSpans()

    expect(frame).toContain("TERMINAL TOO SMALL")
    expect(frame).toContain("52 x 16")
    const headingSpan = spans.lines
      .flatMap((line) => line.spans)
      .find((span) => span.text === "TERMINAL TOO SMALL")
    expect(headingSpan?.fg.toInts()).toEqual(
      RGBA.fromHex(theme.colors.error).toInts(),
    )
  })
})
