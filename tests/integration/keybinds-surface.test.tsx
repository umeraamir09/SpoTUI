import { afterEach, describe, expect, test } from "bun:test"
import type { CliRenderer } from "@opentui/core"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
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

describe("keybind reference", () => {
  test("opens from the player header and closes with Escape", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        onQuit={() => undefined}
      />,
      { height: 30, width: 110, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    await clickRenderable(harness.renderer, harness.mockMouse, "keybinds-open")
    await harness.renderOnce()
    const reference = harness.captureCharFrame()
    expect(reference).toContain("KEYBINDS")
    expect(reference).toContain("SEARCH: ENTER / A")
    expect(reference).toContain("DEVICES: ENTER")

    act(() => {
      harness.mockInput.pressEscape()
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("Warm Receiver")
  })
})

async function clickRenderable(
  renderer: CliRenderer,
  mouse: { click: (x: number, y: number) => Promise<void> },
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
