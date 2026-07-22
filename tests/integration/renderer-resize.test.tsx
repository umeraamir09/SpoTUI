import { afterEach, describe, expect, mock, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
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

describe("responsive renderer", () => {
  test("reflows through large, compact, and too-small modes without stale frame content", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createInactivePlaybackController()}
        onQuit={() => undefined}
      />,
      {
        width: 140,
        height: 40,
      },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })

    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("NOTHING PLAYING")

    act(() => {
      harness.resize(72, 22)
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("COMPACT VINYL")

    act(() => {
      harness.resize(51, 15)
    })
    await harness.renderOnce()
    const frame = harness.captureCharFrame()
    expect(frame).toContain("TERMINAL TOO SMALL")
    expect(frame).not.toContain("COMPACT DECK")
  })

  test("dispatches q through the OpenTUI keymap to the quit command", async () => {
    const onQuit = mock(() => undefined)
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createInactivePlaybackController()}
        onQuit={onQuit}
      />,
      {
        width: 90,
        height: 26,
      },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressKey("q")
    })

    expect(onQuit).toHaveBeenCalledTimes(1)
  })

  test("survives repeated resize and device-modal cycles without stale overlays", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createInactivePlaybackController()}
        onQuit={() => undefined}
      />,
      { height: 40, width: 140, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    for (let cycle = 0; cycle < 5; cycle += 1) {
      act(() => {
        harness.mockInput.pressKey("d")
      })
      await harness.renderOnce()
      expect(harness.captureCharFrame()).toContain(
        "CHOOSE SPOTIFY DEVICE",
      )

      act(() => {
        harness.resize(cycle % 2 === 0 ? 72 : 90, cycle % 2 === 0 ? 22 : 26)
        harness.mockInput.pressEscape()
      })
      await harness.renderOnce()
      const frame = harness.captureCharFrame()
      expect(frame).not.toContain("CHOOSE SPOTIFY DEVICE")
      expect(frame).toContain(
        cycle % 2 === 0 ? "COMPACT LAYOUT" : "MEDIUM LAYOUT",
      )
    }
  })
})
