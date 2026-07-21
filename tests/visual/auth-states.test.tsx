import { afterEach, describe, expect, test } from "bun:test"
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

const STATES: readonly [string, AuthViewState][] = [
  [
    "first-run",
    { status: "needs-client-id", validationError: null },
  ],
  [
    "ready",
    {
      status: "ready",
      clientIdSource: "config",
      notice: null,
    },
  ],
  [
    "authorizing",
    {
      status: "authorizing",
      callbackUri: "http://127.0.0.1:43123/callback",
    },
  ],
  [
    "error",
    {
      status: "error",
      kind: "authorization-denied",
      message: "Spotify authorization was denied. You can retry when ready.",
      retryable: true,
    },
  ],
]

describe("Phase 1 authorization frames", () => {
  for (const [name, state] of STATES) {
    test(name, async () => {
      const harness = await testRender(
        <App
          authController={createStaticAuthController(state)}
          playbackController={createInactivePlaybackController()}
          onQuit={() => undefined}
        />,
        { width: 90, height: 26 },
      )
      destroyers.push(() => {
        harness.renderer.destroy()
      })

      await harness.renderOnce()
      const frame = harness.captureCharFrame()

      expect(frame).toMatchSnapshot()
      expect(frame).not.toMatch(/access-sensitive|refresh-sensitive/)
    })
  }
})
