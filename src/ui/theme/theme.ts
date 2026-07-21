import type { TerminalCapabilities } from "@opentui/core"

import type { RuntimeUiOptions } from "../../config/runtime-ui-options"
import type { CustomThemeDefinition } from "./custom-theme"
import {
  ansi256Palette,
  isThemePresetName,
  monochromePalette,
  THEME_PRESETS,
  warmPhosphorPalette,
  type ThemeColors,
} from "./palette"

export type { CustomThemeDefinition } from "./custom-theme"

export interface AppTheme {
  name: string
  colors: ThemeColors
  glyphs: {
    separator: string
    statusIdle: string
    statusReady: string
    progressComplete: string
    progressRemaining: string
    transportShuffle: string
    transportPrevious: string
    transportPlay: string
    transportPause: string
    transportNext: string
    transportRepeat: string
  }
  presentation: {
    borders: boolean
    unicode: boolean
  }
}

const UNICODE_GLYPHS: AppTheme["glyphs"] = {
  separator: "·",
  statusIdle: "○",
  statusReady: "◆",
  progressComplete: "━",
  progressRemaining: "─",
  transportShuffle: "⇄",
  transportPrevious: "|◀",
  transportPlay: "▶",
  transportPause: "Ⅱ",
  transportNext: "▶|",
  transportRepeat: "↻",
}

const ASCII_GLYPHS: AppTheme["glyphs"] = {
  separator: "|",
  statusIdle: "o",
  statusReady: "*",
  progressComplete: "=",
  progressRemaining: "-",
  transportShuffle: "S",
  transportPrevious: "|<",
  transportPlay: ">",
  transportPause: "||",
  transportNext: ">|",
  transportRepeat: "R",
}

export const theme: AppTheme = {
  name: "warm-phosphor",
  colors: warmPhosphorPalette,
  glyphs: UNICODE_GLYPHS,
  presentation: {
    borders: true,
    unicode: true,
  },
}

export function resolveAppTheme(
  options: RuntimeUiOptions,
  capabilities: TerminalCapabilities | null,
  customTheme?: CustomThemeDefinition,
): AppTheme {
  const colorMode =
    options.colorMode === "auto"
      ? capabilities === null || capabilities.rgb
        ? "truecolor"
        : capabilities.ansi256
          ? "ansi256"
          : "monochrome"
      : options.colorMode
  const unicode = !options.asciiArtwork

  if (colorMode === "monochrome" || colorMode === "ansi256") {
    return {
      colors:
        colorMode === "monochrome"
          ? monochromePalette
          : ansi256Palette,
      glyphs: unicode ? UNICODE_GLYPHS : ASCII_GLYPHS,
      name: `${colorMode}-${unicode ? "unicode" : "ascii"}`,
      presentation: {
        borders: unicode,
        unicode,
      },
    }
  }

  const requestedPreset = customTheme?.extends ?? options.themePreset
  const preset = isThemePresetName(requestedPreset)
    ? requestedPreset
    : "warm-phosphor"
  const colors: ThemeColors =
    customTheme === undefined
      ? THEME_PRESETS[preset]
      : {
          ...THEME_PRESETS[preset],
          ...customTheme.colors,
        }

  return {
    colors,
    glyphs: unicode ? UNICODE_GLYPHS : ASCII_GLYPHS,
    name: `${customTheme?.name ?? preset}-${unicode ? "unicode" : "ascii"}`,
    presentation: {
      borders: unicode,
      unicode,
    },
  }
}
