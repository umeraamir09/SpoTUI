import { afterEach, describe, expect, mock, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import { App } from "../../src/app/App"
import {
  createStaticAuthController,
  type AuthViewState,
} from "../../src/auth/auth-controller"
import { createInactivePlaybackController } from "../helpers/playback"

const destroyers: (() => void)[] = []

afterEach(() => {
  act(() => {
    for (const destroy of destroyers.splice(0)) {
      destroy()
    }
  })
})

describe("authorization keymap", () => {
  test("does not let the global q command steal input keystrokes", async () => {
    const onQuit = mock(() => undefined)
    const controller = createStaticAuthController({
      status: "needs-client-id",
      validationError: null,
    })
    const harness = await testRender(
      <App
        authController={controller}
        playbackController={createInactivePlaybackController()}
        onQuit={onQuit}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressKey("q")
    })

    expect(onQuit).not.toHaveBeenCalled()
  })

  test("submits the entered Client ID before exposing login", async () => {
    const submitClientId = mock(() => undefined)
    const controller = {
      ...createStaticAuthController({
        status: "needs-client-id",
        validationError: null,
      }),
      submitClientId,
    }
    const harness = await testRender(
      <App
        authController={controller}
        playbackController={createInactivePlaybackController()}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    await act(async () => {
      await harness.mockInput.typeText("client12345")
      harness.mockInput.pressEnter()
    })

    expect(submitClientId).toHaveBeenCalledWith("client12345")
  })

  test("routes Enter to login from the ready state", async () => {
    const login = mock(() => undefined)
    const controller = createController(
      {
        status: "ready",
        clientIdSource: "config",
        notice: null,
      },
      { login },
    )
    const harness = await testRender(
      <App
        authController={controller}
        playbackController={createInactivePlaybackController()}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressEnter()
    })

    expect(login).toHaveBeenCalledTimes(1)
  })

  test("routes Escape to cancellation while authorization owns the surface", async () => {
    const cancel = mock(() => undefined)
    const controller = createController(
      {
        status: "authorizing",
        callbackUri: "http://127.0.0.1:43123/callback",
      },
      { cancel },
    )
    const harness = await testRender(
      <App
        authController={controller}
        playbackController={createInactivePlaybackController()}
        onQuit={() => undefined}
      />,
      { width: 90, height: 26, kittyKeyboard: true },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    act(() => {
      harness.mockInput.pressEscape()
    })

    expect(cancel).toHaveBeenCalledTimes(1)
  })
})

function createController(
  state: AuthViewState,
  overrides: {
    cancel?: () => void
    login?: () => void
  },
) {
  return {
    ...createStaticAuthController(state),
    ...overrides,
  }
}
