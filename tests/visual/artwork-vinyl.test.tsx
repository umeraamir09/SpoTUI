import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { createAuthenticatedAuthController } from "../helpers/auth"
import {
  createArtworkControllerForState,
  createReadyArtworkController,
  createTestArtworkFrame,
  createTestStaticArtworkFrame,
} from "../helpers/artwork"
import { createPlayingPlaybackController } from "../helpers/playback"

const destroyers: (() => void)[] = []

afterEach(() => {
  act(() => {
    for (const destroy of destroyers.splice(0)) {
      destroy()
    }
  })
})

describe("Phase 5 vinyl frames", () => {
  for (const scenario of [
    { frame: { width: 54, height: 27 }, terminal: { width: 140, height: 40 } },
    { frame: { width: 26, height: 13 }, terminal: { width: 90, height: 26 } },
    { frame: { width: 10, height: 3 }, terminal: { width: 72, height: 22 } },
  ] as const) {
    test(
      `full-face vinyl ${String(scenario.terminal.width)}x${String(scenario.terminal.height)}`,
      async () => {
        const frame = await createTestArtworkFrame(
          scenario.frame.width,
          scenario.frame.height,
        )
        const staticFrame = await createTestStaticArtworkFrame(
          scenario.frame.width,
          scenario.frame.height,
        )
        const harness = await testRender(
          <App
            artworkController={createReadyArtworkController(
              frame,
              staticFrame,
            )}
            authController={createAuthenticatedAuthController()}
            playbackController={createPlayingPlaybackController()}
            onQuit={() => undefined}
          />,
          scenario.terminal,
        )
        destroyers.push(() => {
          harness.renderer.destroy()
        })
        await harness.renderOnce()
        const output = harness.captureCharFrame()

        expect(output).not.toContain("•")
        expect(output).not.toContain("ROTATING FULL-FACE ART")
        if (scenario.terminal.width === 140) {
          expect(maxVinylRowWidth(output)).toBeGreaterThanOrEqual(48)
        }
        expect(output).toMatchSnapshot()
      },
    )
  }

  test("falls back to a stable ASCII record when artwork is unavailable", async () => {
    const harness = await testRender(
      <App
        artworkController={createArtworkControllerForState({
          frame: null,
          message: "Spotify did not provide artwork for this item.",
          rotating: false,
          sourceKey: "track:track-one",
          staticFrame: null,
          status: "unavailable",
        })}
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
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

  test("toggles album art without rendering spin-status text", async () => {
    const frame = await createTestArtworkFrame(26, 13)
    const staticFrame = await createTestStaticArtworkFrame(26, 13)
    const harness = await testRender(
      <App
        artworkController={createReadyArtworkController(frame, staticFrame)}
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    expect(harness.renderer.root.findDescendantById("album-art")).toBeDefined()
    const toggle = harness.renderer.root.findDescendantById("artwork-toggle")
    expect(toggle).toBeDefined()
    if (toggle === undefined) {
      return
    }
    await act(async () => {
      await harness.mockMouse.click(
        toggle.screenX + Math.floor(toggle.width / 2),
        toggle.screenY + Math.floor(toggle.height / 2),
      )
    })
    await harness.renderOnce()

    expect(harness.renderer.root.findDescendantById("vinyl-art")).toBeDefined()
    expect(harness.captureCharFrame()).not.toContain("CLICK TO SPIN")
    expect(harness.captureCharFrame()).not.toContain("SPINNING")
  })
})

function maxVinylRowWidth(output: string): number {
  return Math.max(
    ...output
      .split("\n")
      .map(
        (line) =>
          line.match(/[▀▄•]/gu)?.length ?? 0,
      ),
  )
}
