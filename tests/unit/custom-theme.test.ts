import { describe, expect, test } from "bun:test"

import {
  parseCustomTheme,
  ThemeValidationError,
} from "../../src/ui/theme/custom-theme"

describe("custom theme files", () => {
  test("accepts a named partial palette with preset inheritance", () => {
    expect(
      parseCustomTheme(
        JSON.stringify({
          name: "ocean-radio",
          extends: "midnight-blue",
          colors: {
            accent: "#55DDEE",
            textPrimary: "#F4FBFF",
          },
        }),
      ),
    ).toEqual({
      name: "ocean-radio",
      extends: "midnight-blue",
      colors: {
        accent: "#55DDEE",
        textPrimary: "#F4FBFF",
      },
    })
  })

  test("rejects unknown presets, unknown tokens, and unsafe colors", () => {
    for (const input of [
      {
        extends: "missing-theme",
        colors: { accent: "#FFFFFF" },
      },
      {
        colors: { mystery: "#FFFFFF" },
      },
      {
        colors: { accent: "red;escape-sequence" },
      },
    ]) {
      expect(() => {
        parseCustomTheme(JSON.stringify(input))
      }).toThrow(ThemeValidationError)
    }
  })
})
