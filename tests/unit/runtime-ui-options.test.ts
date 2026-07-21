import { describe, expect, test } from "bun:test"

import { parseRuntimeUiOptions } from "../../src/config/runtime-ui-options"

describe("runtime artwork options", () => {
  test("enables the normal full-color animated renderer by default", () => {
    expect(parseRuntimeUiOptions([])).toEqual({
      albumArt: true,
      animations: true,
      asciiArtwork: false,
      colorMode: "auto",
      themeFile: null,
      themePreset: "warm-phosphor",
      themePresetExplicit: false,
    })
  })

  test("supports explicit animation and artwork fallbacks", () => {
    expect(
      parseRuntimeUiOptions([
        "--no-animations",
        "--no-art",
      ]),
    ).toEqual({
      albumArt: false,
      animations: false,
      asciiArtwork: false,
      colorMode: "auto",
      themeFile: null,
      themePreset: "warm-phosphor",
      themePresetExplicit: false,
    })
    expect(parseRuntimeUiOptions(["--ascii"])).toEqual({
      albumArt: false,
      animations: true,
      asciiArtwork: true,
      colorMode: "auto",
      themeFile: null,
      themePreset: "warm-phosphor",
      themePresetExplicit: false,
    })
  })

  test("supports explicit reduced-color modes", () => {
    expect(parseRuntimeUiOptions(["--256-color"]).colorMode).toBe(
      "ansi256",
    )
    expect(parseRuntimeUiOptions(["--monochrome"]).colorMode).toBe(
      "monochrome",
    )
  })

  test("selects preset and custom theme files from split or equals arguments", () => {
    expect(
      parseRuntimeUiOptions([
        "--theme",
        "midnight-blue",
        "--theme-file=./listener-theme.json",
      ]),
    ).toMatchObject({
      themeFile: "./listener-theme.json",
      themePreset: "midnight-blue",
    })
    expect(
      parseRuntimeUiOptions(["--theme=forest-terminal"]).themePreset,
    ).toBe("forest-terminal")
    expect(
      parseRuntimeUiOptions(["--theme=forest-terminal"])
        .themePresetExplicit,
    ).toBe(true)
  })
})
