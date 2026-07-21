import { afterEach, describe, expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { createStaticPlaybackController } from "../../src/playback/playback-controller"
import { UiController } from "../../src/ui/state/ui-controller"
import { theme } from "../../src/ui/theme/theme"
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

describe("Phase 3 toast and error system", () => {
  test("does not render pending or successful command notifications", async () => {
    const uiController = new UiController()
    uiController.showToast({
      key: "command-pending",
      message: "Sending player.next",
      tone: "info",
    })
    uiController.showToast({
      key: "command-complete",
      message: "Player next complete",
      tone: "success",
    })
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createStaticPlaybackController({
          ...TEST_PLAYING_STATE,
          pendingCommand: "player.next",
        })}
        uiController={uiController}
        onQuit={() => undefined}
      />,
      { height: 30, width: 110 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    const frame = harness.captureCharFrame()
    expect(frame).not.toContain("sending player.next")
    expect(frame).not.toContain("PLAYER NEXT")
    expect(frame).not.toContain("complete")
    expect(uiController.getSnapshot().toasts).toHaveLength(2)
  })

  test("promotes playback failures to a styled, deduplicated notification", async () => {
    const uiController = new UiController()
    const message =
      "Spotify could not be reached. Last known playback is marked stale."
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createStaticPlaybackController({
          ...TEST_PLAYING_STATE,
          notice: { kind: "network", message },
          stale: true,
        })}
        uiController={uiController}
        onQuit={() => undefined}
      />,
      { height: 30, width: 110 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()
    await harness.renderOnce()

    const frame = harness.captureCharFrame()
    const spans = harness.captureSpans()
    expect(frame).toContain("CONNECTION ERROR")
    expect(frame).toContain("Spotify could not be reached")
    expect(uiController.getSnapshot().toasts).toHaveLength(1)

    const messageSpan = spans.lines
      .flatMap((line) => line.spans)
      .find((span) => span.text.includes("Spotify could not be reached"))
    expect(messageSpan?.fg.toInts()).toEqual(
      RGBA.fromHex(theme.colors.error).toInts(),
    )
  })
})
