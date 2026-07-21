import { describe, expect, test } from "bun:test"
import type { CliRendererConfig } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"

import { bootstrap } from "../../src/app/bootstrap"
import { createAuthenticatedAuthController } from "../helpers/auth"
import { createInactivePlaybackController } from "../helpers/playback"
import { MemoryConfigStore } from "../../src/config/config"
import { midnightBluePalette } from "../../src/ui/theme/palette"

async function settleBootstrapRender(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

describe("application bootstrap", () => {
  test("configures alternate-screen cleanup and exits after q", async () => {
    const harness = await createTestRenderer({
      width: 90,
      height: 26,
      exitOnCtrlC: true,
    })
    let rendererConfig: CliRendererConfig | undefined

    const running = bootstrap({
      authController: createAuthenticatedAuthController(),
      playbackController: createInactivePlaybackController(),
      createRenderer: (config) => {
        rendererConfig = config
        return Promise.resolve(harness.renderer)
      },
    })

    await settleBootstrapRender()
    await settleBootstrapRender()
    await harness.renderOnce()
    await harness.waitForFrame((frame) => frame.includes("NOTHING PLAYING"))
    harness.mockInput.pressKey("q")
    await running

    expect(rendererConfig?.screenMode).toBe("alternate-screen")
    expect(rendererConfig?.clearOnShutdown).toBe(true)
    expect(rendererConfig?.targetFps).toBe(12)
    expect(rendererConfig?.maxFps).toBe(12)
    expect(harness.renderer.isDestroyed).toBe(true)
  })

  test("observes OpenTUI Ctrl+C destruction and resolves cleanly", async () => {
    const harness = await createTestRenderer({
      width: 72,
      height: 22,
      exitOnCtrlC: true,
    })

    const running = bootstrap({
      authController: createAuthenticatedAuthController(),
      playbackController: createInactivePlaybackController(),
      createRenderer: () => Promise.resolve(harness.renderer),
    })

    await settleBootstrapRender()
    harness.mockInput.pressCtrlC()
    await running

    expect(harness.renderer.isDestroyed).toBe(true)
  })

  test("propagates renderer initialization failures without installing the app", async () => {
    const failure = new Error("native renderer unavailable")
    let caught: unknown

    try {
      await bootstrap({
        authController: createAuthenticatedAuthController(),
        playbackController: createInactivePlaybackController(),
        createRenderer: () => Promise.reject(failure),
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBe(failure)
  })

  test("loads the saved theme before renderer initialization", async () => {
    const harness = await createTestRenderer({
      width: 90,
      height: 26,
      exitOnCtrlC: true,
    })
    let rendererConfig: CliRendererConfig | undefined

    const running = bootstrap({
      authController: createAuthenticatedAuthController(),
      configStore: new MemoryConfigStore(
        "abc123client",
        "midnight-blue",
      ),
      playbackController: createInactivePlaybackController(),
      createRenderer: (config) => {
        rendererConfig = config
        return Promise.resolve(harness.renderer)
      },
    })

    await settleBootstrapRender()
    await settleBootstrapRender()
    await harness.renderOnce()
    await harness.waitForFrame((frame) =>
      frame.includes("NOTHING PLAYING"),
    )
    harness.mockInput.pressKey("q")
    await running

    expect(rendererConfig?.backgroundColor).toBe(
      midnightBluePalette.background,
    )
  })
})
