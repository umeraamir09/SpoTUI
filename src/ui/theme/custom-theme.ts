import { z } from "zod"

import {
  THEME_PRESET_NAMES,
  type ThemeColors,
} from "./palette"

const color = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/)

const colorsSchema = z
  .object({
    background: color.optional(),
    surface: color.optional(),
    surfaceRaised: color.optional(),
    textPrimary: color.optional(),
    textSecondary: color.optional(),
    textMuted: color.optional(),
    accent: color.optional(),
    accentSecondary: color.optional(),
    border: color.optional(),
    error: color.optional(),
    spotify: color.optional(),
  })
  .strict()
  .refine((colors) => Object.keys(colors).length > 0, {
    message: "A custom theme must define at least one color",
  })

const customThemeSchema = z
  .object({
    name: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
      .optional(),
    extends: z.enum(THEME_PRESET_NAMES).optional(),
    colors: colorsSchema,
  })
  .strict()

export interface CustomThemeDefinition {
  name?: string | undefined
  extends?: (typeof THEME_PRESET_NAMES)[number] | undefined
  colors: Partial<ThemeColors>
}

export class ThemeValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "ThemeValidationError"
  }
}

export function parseCustomTheme(
  source: string,
): CustomThemeDefinition {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    throw new ThemeValidationError(
      "Custom theme is not valid JSON.",
      { cause: error },
    )
  }

  const result = customThemeSchema.safeParse(parsed)
  if (!result.success) {
    throw new ThemeValidationError(
      `Custom theme is invalid: ${z.prettifyError(result.error)}`,
    )
  }
  return result.data as CustomThemeDefinition
}

export async function loadCustomThemeFile(
  path: string,
): Promise<CustomThemeDefinition> {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    throw new ThemeValidationError(
      `Custom theme file was not found: ${path}`,
    )
  }
  try {
    return parseCustomTheme(await file.text())
  } catch (error) {
    if (error instanceof ThemeValidationError) {
      throw error
    }
    throw new ThemeValidationError(
      `Custom theme could not be read: ${path}`,
      { cause: error },
    )
  }
}
