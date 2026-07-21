import {
  afterEach,
  describe,
  expect,
  test,
} from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { FileConfigStore } from "../../src/config/config"

const temporaryDirectories: string[] = []

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})

describe("application config store", () => {
  test("persists a UI theme without erasing Spotify or future config fields", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "umroofm-config-"),
    )
    temporaryDirectories.push(directory)
    const path = join(directory, "config.toml")
    await Bun.write(
      path,
      [
        "[spotify]",
        'client_id = "abc123client"',
        "",
        "[controls]",
        "volume_step = 7",
        "",
      ].join("\n"),
    )
    const store = new FileConfigStore(path)

    await store.setThemePreset("midnight-blue")

    expect(await store.getClientId()).toBe("abc123client")
    expect(await store.getThemePreset()).toBe("midnight-blue")
    expect(await Bun.file(path).text()).toContain(
      "volume_step = 7",
    )
  })

  test("preserves a saved theme when the Spotify Client ID changes", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "umroofm-config-"),
    )
    temporaryDirectories.push(directory)
    const store = new FileConfigStore(
      join(directory, "config.toml"),
    )

    await store.setThemePreset("rosewave")
    await store.setClientId("new123client")

    expect(await store.getThemePreset()).toBe("rosewave")
    expect(await store.getClientId()).toBe("new123client")
  })
})
