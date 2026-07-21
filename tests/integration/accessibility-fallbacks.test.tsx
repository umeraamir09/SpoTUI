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

describe("Phase 3 accessibility fallbacks", () => {
  test("ASCII mode avoids Unicode UI glyphs while preserving controls and metadata", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        uiOptions={{
          albumArt: false,
          animations: false,
          asciiArtwork: true,
          colorMode: "auto",
          themeFile: null,
          themePreset: "warm-phosphor",
          themePresetExplicit: false,
        }}
        onQuit={() => undefined}
      />,
      { height: 26, width: 90 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()
    const frame = harness.captureCharFrame()

    expect(frame).toContain("Warm Receiver")
    expect(frame).toContain("|<")
    expect(frame).toContain("||")
    expect(frame).toContain(">|")
    expect(frame).not.toMatch(/[┌┐└┘─│━▀▄•◆○−×]/u)
  })

  test("monochrome mode keeps all visible text colors achromatic", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        uiOptions={{
          albumArt: false,
          animations: false,
          asciiArtwork: false,
          colorMode: "monochrome",
          themeFile: null,
          themePreset: "warm-phosphor",
          themePresetExplicit: false,
        }}
        onQuit={() => undefined}
      />,
      { height: 26, width: 90 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    const visibleSpans = harness
      .captureSpans()
      .lines.flatMap((line) => line.spans)
      .filter((span) => span.text.trim().length > 0)
    expect(visibleSpans.length).toBeGreaterThan(0)
    expect(
      visibleSpans.every((span) => {
        const [red, green, blue] = span.fg.toInts()
        return red === green && green === blue
      }),
    ).toBe(true)
  })
})
