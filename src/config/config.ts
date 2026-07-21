import { mkdir, rename } from "node:fs/promises"
import { dirname } from "node:path"
import { z } from "zod"

import { getConfigPath } from "./paths"

const spotifyClientIdSchema = z
  .string()
  .trim()
  .min(10, "Spotify Client ID is too short")
  .max(128, "Spotify Client ID is too long")
  .regex(
    /^[A-Za-z0-9]+$/,
    "Spotify Client ID must contain only letters and numbers",
  )

const themePresetSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/)

const configSchema = z
  .object({
    spotify: z
      .object({
        client_id: z.string().optional(),
      })
      .loose()
      .optional(),
    ui: z
      .object({
        theme: themePresetSchema.optional(),
      })
      .loose()
      .optional(),
  })
  .loose()

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConfigValidationError"
  }
}

export interface ConfigStore {
  getClientId: () => Promise<string | null>
  setClientId: (clientId: string) => Promise<void>
  getThemePreset: () => Promise<string | null>
  setThemePreset: (preset: string) => Promise<void>
}

export function validateSpotifyClientId(clientId: string): string {
  const result = spotifyClientIdSchema.safeParse(clientId)
  if (!result.success) {
    throw new ConfigValidationError(
      result.error.issues[0]?.message ?? "Spotify Client ID is invalid",
    )
  }
  return result.data
}

function validateThemePreset(preset: string): string {
  const result = themePresetSchema.safeParse(preset)
  if (!result.success) {
    throw new ConfigValidationError("Theme preset name is invalid")
  }
  return result.data
}

function escapeTomlString(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
}

export class FileConfigStore implements ConfigStore {
  readonly path: string

  constructor(path = getConfigPath()) {
    this.path = path
  }

  async getClientId(): Promise<string | null> {
    const parsed = await this.readConfig()
    const clientId = parsed?.spotify?.client_id
    return clientId === undefined
      ? null
      : validateSpotifyClientId(clientId)
  }

  async setClientId(clientId: string): Promise<void> {
    await this.setStringSetting(
      "spotify",
      "client_id",
      validateSpotifyClientId(clientId),
    )
  }

  async getThemePreset(): Promise<string | null> {
    const parsed = await this.readConfig()
    return parsed?.ui?.theme ?? null
  }

  async setThemePreset(preset: string): Promise<void> {
    await this.setStringSetting(
      "ui",
      "theme",
      validateThemePreset(preset),
    )
  }

  private async readConfig(): Promise<z.infer<typeof configSchema> | null> {
    const file = Bun.file(this.path)
    if (!(await file.exists())) {
      return null
    }
    try {
      return configSchema.parse(Bun.TOML.parse(await file.text()))
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw error
      }
      throw new ConfigValidationError(
        "The UmrooFM config file is invalid",
      )
    }
  }

  private async setStringSetting(
    section: string,
    key: string,
    value: string,
  ): Promise<void> {
    const file = Bun.file(this.path)
    const source = (await file.exists()) ? await file.text() : ""
    if (source.length > 0) {
      try {
        configSchema.parse(Bun.TOML.parse(source))
      } catch {
        throw new ConfigValidationError(
          "The UmrooFM config file is invalid",
        )
      }
    }
    const content = updateTomlString(
      source,
      section,
      key,
      escapeTomlString(value),
    )
    const directory = dirname(this.path)
    const temporaryPath = `${this.path}.tmp`
    await mkdir(directory, { recursive: true })
    await Bun.write(temporaryPath, content)
    await rename(temporaryPath, this.path)
  }
}

export class MemoryConfigStore implements ConfigStore {
  private clientId: string | null
  private themePreset: string | null

  constructor(
    clientId: string | null = null,
    themePreset: string | null = null,
  ) {
    this.clientId = clientId
    this.themePreset = themePreset
  }

  getClientId(): Promise<string | null> {
    return Promise.resolve(this.clientId)
  }

  setClientId(clientId: string): Promise<void> {
    this.clientId = validateSpotifyClientId(clientId)
    return Promise.resolve()
  }

  getThemePreset(): Promise<string | null> {
    return Promise.resolve(this.themePreset)
  }

  setThemePreset(preset: string): Promise<void> {
    this.themePreset = validateThemePreset(preset)
    return Promise.resolve()
  }
}

function updateTomlString(
  source: string,
  section: string,
  key: string,
  escapedValue: string,
): string {
  const newline = source.includes("\r\n") ? "\r\n" : "\n"
  const lines = source.replace(/\r?\n$/u, "").split(/\r?\n/u)
  const sectionHeader = `[${section}]`
  const sectionIndex = lines.findIndex(
    (line) => line.trim() === sectionHeader,
  )
  const setting = `${key} = "${escapedValue}"`

  if (sectionIndex < 0) {
    if (lines.length === 1 && lines[0] === "") {
      return `${sectionHeader}${newline}${setting}${newline}`
    }
    const separator =
      lines.at(-1)?.trim() === "" ? [] : [""]
    return [
      ...lines,
      ...separator,
      sectionHeader,
      setting,
      "",
    ].join(newline)
  }

  let nextSectionIndex = lines.findIndex(
    (line, index) =>
      index > sectionIndex &&
      /^\s*\[[^\]]+\]\s*(?:#.*)?$/u.test(line),
  )
  if (nextSectionIndex < 0) {
    nextSectionIndex = lines.length
  }
  const keyPattern = new RegExp(`^\\s*${key}\\s*=`, "u")
  const settingIndex = lines.findIndex(
    (line, index) =>
      index > sectionIndex &&
      index < nextSectionIndex &&
      keyPattern.test(line),
  )
  if (settingIndex >= 0) {
    lines[settingIndex] = setting
  } else {
    lines.splice(nextSectionIndex, 0, setting)
  }
  return `${lines.join(newline)}${newline}`
}
