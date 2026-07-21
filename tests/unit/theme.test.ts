import { describe, expect, test } from "bun:test"
import type { TerminalCapabilities } from "@opentui/core"

import type { RuntimeUiOptions } from "../../src/config/runtime-ui-options"
import {
  ansi256Palette,
  forestTerminalPalette,
  midnightBluePalette,
  monochromePalette,
  rosewavePalette,
} from "../../src/ui/theme/palette"
import {
  resolveAppTheme,
  type CustomThemeDefinition,
} from "../../src/ui/theme/theme"

const DEFAULT_OPTIONS: RuntimeUiOptions = {
  albumArt: true,
  animations: true,
  asciiArtwork: false,
  colorMode: "auto",
  themeFile: null,
  themePreset: "warm-phosphor",
  themePresetExplicit: false,
}

describe("Phase 3 terminal theme fallbacks", () => {
  test("uses the bounded 256-color palette when RGB is unavailable", () => {
    const theme = resolveAppTheme(
      DEFAULT_OPTIONS,
      {
        ansi256: true,
        rgb: false,
      } as TerminalCapabilities,
    )

    expect(theme.name).toBe("ansi256-unicode")
    expect(theme.colors).toBe(ansi256Palette)
  })

  test("falls back to an achromatic palette when color is unavailable", () => {
    const theme = resolveAppTheme(
      DEFAULT_OPTIONS,
      {
        ansi256: false,
        rgb: false,
      } as TerminalCapabilities,
    )

    expect(theme.name).toBe("monochrome-unicode")
    expect(theme.colors).toBe(monochromePalette)
  })

  test("replaces decorative glyphs and borders in explicit ASCII mode", () => {
    const theme = resolveAppTheme(
      { ...DEFAULT_OPTIONS, asciiArtwork: true },
      null,
    )

    expect(theme.presentation).toEqual({
      borders: false,
      unicode: false,
    })
    expect(theme.glyphs).toEqual({
      progressComplete: "=",
      progressRemaining: "-",
      separator: "|",
      statusIdle: "o",
      statusReady: "*",
      transportNext: ">|",
      transportPause: "||",
      transportPlay: ">",
      transportPrevious: "|<",
      transportRepeat: "R",
      transportShuffle: "S",
    })
  })

  test("exposes cohesive default theme presets", () => {
    expect(
      resolveAppTheme(
        { ...DEFAULT_OPTIONS, themePreset: "midnight-blue" },
        null,
      ).colors,
    ).toBe(midnightBluePalette)
    expect(
      resolveAppTheme(
        { ...DEFAULT_OPTIONS, themePreset: "forest-terminal" },
        null,
      ).colors,
    ).toBe(forestTerminalPalette)
    expect(
      resolveAppTheme(
        { ...DEFAULT_OPTIONS, themePreset: "rosewave" },
        null,
      ).colors,
    ).toBe(rosewavePalette)
  })

  test("merges custom colors over the selected or inherited preset", () => {
    const customTheme: CustomThemeDefinition = {
      colors: {
        accent: "#12ABEF",
        surfaceRaised: "#102030",
      },
      extends: "midnight-blue",
      name: "listener-night",
    }
    const resolved = resolveAppTheme(
      DEFAULT_OPTIONS,
      null,
      customTheme,
    )

    expect(resolved.name).toBe("listener-night-unicode")
    expect(resolved.colors.accent).toBe("#12ABEF")
    expect(resolved.colors.surfaceRaised).toBe("#102030")
    expect(resolved.colors.background).toBe(
      midnightBluePalette.background,
    )
  })
})
