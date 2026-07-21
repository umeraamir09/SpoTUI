import { afterEach, describe, expect, mock, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import { PLAYBACK_BINDINGS } from "../../src/input/playback-keymap"
import { createAuthenticatedAuthController } from "../helpers/auth"
import {
  createPlayingPlaybackController,
} from "../helpers/playback"

const destroyers: (() => void)[] = []

afterEach(() => {
  act(() => {
    for (const destroy of destroyers.splice(0)) {
      destroy()
    }
  })
})

describe("playback keymap", () => {
  test("declares every Phase 2 player command through named bindings", () => {
    const commands = PLAYBACK_BINDINGS.map((binding) => binding.cmd)

    expect(commands).toContain("player.toggle")
    expect(commands).toContain("player.next")
    expect(commands).toContain("player.previous")
    expect(commands).toContain("player.seek-back-small")
    expect(commands).toContain("player.seek-forward-large")
    expect(commands).toContain("volume.mute")
    expect(commands).toContain("player.shuffle")
    expect(commands).toContain("player.repeat")
    expect(commands).toContain("device.open")
  })

  test("dispatches transport commands without involving React rendering logic", async () => {
    const togglePlayback = mock(() => undefined)
    const next = mock(() => undefined)
    const controller = {
      ...createPlayingPlaybackController(),
      togglePlayback,
      next,
    }
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={controller}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressKey(" ")
      harness.mockInput.pressKey("n")
    })

    expect(togglePlayback).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledTimes(1)
  })

  test("opens and closes the device picker as a modal surface", async () => {
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={createPlayingPlaybackController()}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressKey("d")
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain(
      "CHOOSE SPOTIFY DEVICE",
    )

    act(() => {
      harness.mockInput.pressEscape()
    })
    await harness.renderOnce()
    expect(harness.captureCharFrame()).toContain(
      "Warm Receiver",
    )
  })

  test("transfers to the selected device from the picker", async () => {
    const transferTo = mock(() => undefined)
    const controller = {
      ...createPlayingPlaybackController(),
      transferTo,
    }
    const harness = await testRender(
      <App
        authController={createAuthenticatedAuthController()}
        playbackController={controller}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressKey("d")
    })
    await harness.renderOnce()
    act(() => {
      harness.mockInput.pressArrow("down")
      harness.mockInput.pressEnter()
    })

    expect(transferTo).toHaveBeenCalledWith("device-phone", false)
  })
})
