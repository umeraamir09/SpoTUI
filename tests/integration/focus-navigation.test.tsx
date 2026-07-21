import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { UiController } from "../../src/ui/state/ui-controller"
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

describe("Phase 3 focus navigation", () => {
  test("Tab and Shift+Tab move a persistent, visible player focus", async () => {
    const uiController = new UiController()
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        uiController={uiController}
        onQuit={() => undefined}
      />,
      { height: 26, width: 90, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("FOCUS TRANSPORT")
    expect(harness.renderer.currentFocusedRenderable?.id).toBe(
      "focus-transport",
    )

    act(() => {
      harness.mockInput.pressTab()
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("FOCUS PROGRESS")
    expect(harness.renderer.currentFocusedRenderable?.id).toBe(
      "focus-progress",
    )

    act(() => {
      harness.mockInput.pressTab({ shift: true })
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("FOCUS TRANSPORT")
  })

  test("compact layouts expose only focus regions that remain visible", async () => {
    const uiController = new UiController()
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        uiController={uiController}
        onQuit={() => undefined}
      />,
      { height: 16, width: 52, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressTab()
      harness.mockInput.pressTab()
      harness.mockInput.pressTab()
    })
    await harness.renderOnce()

    expect(uiController.getSnapshot().focusTarget).toBe("transport")
    expect(harness.captureCharFrame()).toContain("FOCUS TRANSPORT")
  })
})
