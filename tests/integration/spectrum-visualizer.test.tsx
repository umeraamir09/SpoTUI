import { afterEach, describe, expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { createStaticPlaybackController } from "../../src/playback/playback-controller"
import {
  midnightBluePalette,
  warmPhosphorPalette,
} from "../../src/ui/theme/palette"
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

describe("track spectrum visualizer", () => {
  test("renders a mirrored frame with colors from the selected theme", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createStaticPlaybackController(
          TEST_PLAYING_STATE,
        )}
        uiOptions={{
          albumArt: false,
          animations: false,
          asciiArtwork: false,
          colorMode: "auto",
          themeFile: null,
          themePreset: "midnight-blue",
          themePresetExplicit: true,
        }}
        onQuit={() => undefined}
      />,
      { height: 30, width: 110 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    const spectrum =
      harness.renderer.root.findDescendantById("track-spectrum")
    expect(spectrum).toBeDefined()
    if (spectrum === undefined) {
      throw new Error("Spectrum renderable was not mounted.")
    }
    expect(spectrum.width).toBe(48)
    expect(spectrum.height).toBe(6)

    const frameLines = harness.captureCharFrame().split("\n")
    const foundation =
      harness.renderer.root.findDescendantById("player-foundation")
    expect(foundation).toBeDefined()
    if (foundation === undefined) {
      throw new Error("Player foundation was not mounted.")
    }
    const spectrumCenter = spectrum.screenX + spectrum.width / 2
    const foundationCenter =
      foundation.screenX + foundation.width / 2
    expect(
      Math.abs(spectrumCenter - foundationCenter),
    ).toBeLessThanOrEqual(1)
    const titleRow = frameLines.findIndex((line) =>
      line.includes("Warm Receiver"),
    )
    expect(titleRow).toBe(spectrum.screenY + spectrum.height)

    const spectrumRows = frameLines
      .slice(spectrum.screenY, spectrum.screenY + spectrum.height)
      .map((line) =>
        line.slice(
          spectrum.screenX,
          spectrum.screenX + spectrum.width,
        ),
      )
    expect(spectrumRows.slice(0, 3)).toEqual(
      spectrumRows.slice(3).reverse(),
    )

    const allowedColors = new Set([
      RGBA.fromHex(midnightBluePalette.accent).toInts().join(","),
      RGBA.fromHex(midnightBluePalette.accentSecondary)
        .toInts()
        .join(","),
    ])
    const spectrumColors = harness
      .captureSpans()
      .lines.flatMap((line) => line.spans)
      .filter((span) => span.text.includes("▮"))
      .map((span) => span.fg.toInts().join(","))
    expect(spectrumColors.length).toBeGreaterThan(0)
    expect(
      spectrumColors.every((color) => allowedColors.has(color)),
    ).toBe(true)
  })

  test("freezes into the muted theme color while paused", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createStaticPlaybackController({
          ...TEST_PLAYING_STATE,
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
        })}
        onQuit={() => undefined}
      />,
      { height: 30, width: 110 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    const muted = RGBA.fromHex(warmPhosphorPalette.textMuted)
      .toInts()
      .join(",")
    const spectrumColors = harness
      .captureSpans()
      .lines.flatMap((line) => line.spans)
      .filter((span) => span.text.includes("▮"))
      .map((span) => span.fg.toInts().join(","))

    expect(spectrumColors.length).toBeGreaterThan(0)
    expect(spectrumColors.every((color) => color === muted)).toBe(
      true,
    )
  })
})
