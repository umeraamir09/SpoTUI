import { afterEach, describe, expect, test } from "bun:test"
import {
  RGBA,
  type CapturedFrame,
  type CliRenderer,
} from "@opentui/core"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { MemoryConfigStore } from "../../src/config/config"
import {
  midnightBluePalette,
  warmPhosphorPalette,
} from "../../src/ui/theme/palette"
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

describe("live theme settings", () => {
  test("previews with the keyboard and Escape restores the committed theme", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        onQuit={() => undefined}
      />,
      { height: 26, width: 90, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressKey(",")
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("PREVIEW UPDATES IMMEDIATELY")

    act(() => {
      harness.mockInput.pressArrow("down")
    })
    await harness.renderOnce()
    expect(headerAccent(harness)).toEqual(
      RGBA.fromHex(midnightBluePalette.accent).toInts(),
    )

    act(() => {
      harness.mockInput.pressEscape()
    })
    await harness.renderOnce()
    expect(headerAccent(harness)).toEqual(
      RGBA.fromHex(warmPhosphorPalette.accent).toInts(),
    )
  })

  test("mouse selection previews immediately and Apply persists it", async () => {
    const configStore = new MemoryConfigStore("abc123client")
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        configStore={configStore}
        playbackController={createPlayingPlaybackController()}
        onQuit={() => undefined}
      />,
      { height: 26, width: 90, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    await clickRenderable(
      harness.renderer,
      harness.mockMouse,
      "settings-open",
    )
    await harness.renderOnce()
    await clickRenderable(
      harness.renderer,
      harness.mockMouse,
      "theme-option-midnight-blue",
    )
    await harness.renderOnce()
    expect(headerAccent(harness)).toEqual(
      RGBA.fromHex(midnightBluePalette.accent).toInts(),
    )

    await clickRenderable(
      harness.renderer,
      harness.mockMouse,
      "settings-apply",
    )
    await harness.renderOnce()
    expect(await configStore.getThemePreset()).toBe(
      "midnight-blue",
    )
    expect(harness.captureCharFrame()).toContain("Warm Receiver")
  })
})

function headerAccent(harness: {
  captureSpans: () => CapturedFrame
}): number[] | undefined {
  return harness
    .captureSpans()
    .lines.flatMap((line) => line.spans)
    .find((span) => span.text.includes("Spo"))
    ?.fg.toInts()
}

async function clickRenderable(
  renderer: CliRenderer,
  mouse: {
    click: (x: number, y: number) => Promise<void>
  },
  id: string,
): Promise<void> {
  const renderable = renderer.root.findDescendantById(id)
  if (renderable === undefined) {
    throw new Error(`Missing renderable: ${id}`)
  }
  await act(async () => {
    await mouse.click(
      renderable.screenX + Math.floor(renderable.width / 2),
      renderable.screenY + Math.floor(renderable.height / 2),
    )
  })
}
