import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { createStaticLyricsController } from "../../src/lyrics/lyrics-service"
import { createAuthenticatedAuthController } from "../helpers/auth"
import { createPlayingPlaybackController } from "../helpers/playback"

const destroyers: (() => void)[] = []
afterEach(() => act(() => { for (const destroy of destroyers.splice(0)) destroy() }))

describe("lyrics panel keymap", () => {
  test("toggles the lyrics panel and opens the information panel", async () => {
    const harness = await testRender(
      <App authController={createAuthenticatedAuthController()} playbackController={createPlayingPlaybackController()} lyricsController={createStaticLyricsController()} onQuit={() => undefined} />,
      { width: 110, height: 30, kittyKeyboard: true },
    )
    destroyers.push(() => harness.renderer.destroy())
    await harness.renderOnce()
    act(() => harness.mockInput.pressKey("y"))
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("Start a track to view lyrics.")
    act(() => harness.mockInput.pressKey("i"))
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain("Night Signals")
  })
})
