import { afterEach, describe, expect, mock, test } from "bun:test"
import type { CliRenderer, Renderable } from "@opentui/core"
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

describe("mouse-first player controls", () => {
  test("every visible player button invokes the same playback action as its shortcut", async () => {
    const toggleShuffle = mock(() => undefined)
    const previous = mock(() => undefined)
    const togglePlayback = mock(() => undefined)
    const next = mock(() => undefined)
    const cycleRepeat = mock(() => undefined)
    const adjustVolume = mock(() => undefined)
    const toggleMute = mock(() => undefined)
    const transferTo = mock(() => undefined)
    const controller = {
      ...createPlayingPlaybackController(),
      adjustVolume,
      cycleRepeat,
      next,
      previous,
      toggleMute,
      togglePlayback,
      toggleShuffle,
      transferTo,
    }
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={controller}
        onQuit={() => undefined}
      />,
      { height: 30, width: 110 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    for (const id of [
      "transport-shuffle",
      "transport-previous",
      "transport-toggle",
      "transport-next",
      "transport-repeat",
      "volume-down",
      "volume-mute",
      "volume-up",
    ]) {
      await clickRenderable(harness.renderer, harness.mockMouse, id)
    }

    expect(toggleShuffle).toHaveBeenCalledTimes(1)
    expect(previous).toHaveBeenCalledTimes(1)
    expect(togglePlayback).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledTimes(1)
    expect(cycleRepeat).toHaveBeenCalledTimes(1)
    expect(adjustVolume).toHaveBeenNthCalledWith(1, -5)
    expect(adjustVolume).toHaveBeenNthCalledWith(2, 5)
    expect(toggleMute).toHaveBeenCalledTimes(1)

    await clickRenderable(
      harness.renderer,
      harness.mockMouse,
      "device-open",
    )
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain(
      "CHOOSE SPOTIFY DEVICE",
    )
    await clickRenderable(
      harness.renderer,
      harness.mockMouse,
      "device-option-1",
    )
    expect(transferTo).toHaveBeenCalledWith(
      "device-phone",
      false,
    )
  })

  test("clicking and dragging the progress track commits an absolute seek", async () => {
    const seekTo = mock(() => undefined)
    const controller = {
      ...createPlayingPlaybackController(),
      seekTo,
    }
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={controller}
        onQuit={() => undefined}
      />,
      { height: 30, width: 110 },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    const track = findRenderable(
      harness.renderer,
      "progress-track",
    )
    const startX = track.screenX + 1
    const endOffset = Math.round((track.width - 1) * 0.75)
    const endX = track.screenX + endOffset
    const y = track.screenY

    await act(async () => {
      await harness.mockMouse.drag(startX, y, endX, y)
    })

    expect(seekTo).toHaveBeenCalledTimes(1)
    expect(seekTo).toHaveBeenCalledWith(
      Math.round((endOffset / (track.width - 1)) * 240_000),
    )
  })
})

function findRenderable(
  renderer: CliRenderer,
  id: string,
): Renderable {
  const renderable = renderer.root.findDescendantById(id)
  if (renderable === undefined) {
    throw new Error(`Missing renderable: ${id}`)
  }
  return renderable
}

async function clickRenderable(
  renderer: CliRenderer,
  mouse: {
    click: (x: number, y: number) => Promise<void>
  },
  id: string,
): Promise<void> {
  const renderable = findRenderable(renderer, id)
  await act(async () => {
    await mouse.click(
      renderable.screenX + Math.floor(renderable.width / 2),
      renderable.screenY + Math.floor(renderable.height / 2),
    )
  })
}
