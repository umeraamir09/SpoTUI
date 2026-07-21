import { describe, expect, test } from "bun:test"

import {
  startLoopbackCallbackServer,
} from "../../src/auth/callback-server"

describe("Spotify loopback callback server", () => {
  test("binds only to 127.0.0.1, validates state, and returns the code in-process", async () => {
    const session = startLoopbackCallbackServer({
      expectedState: "expected-state",
      timeoutMs: 5_000,
    })

    expect(session.redirectUri).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/callback$/,
    )

    const callbackResponse = await fetch(
      `${session.redirectUri}?code=authorization-sensitive&state=expected-state`,
    )
    const result = await session.result

    expect(callbackResponse.status).toBe(200)
    expect(await callbackResponse.text()).not.toContain(
      "authorization-sensitive",
    )
    expect(result).toEqual({ code: "authorization-sensitive" })
    await session.close()
  })

  test("rejects a mismatched OAuth state", async () => {
    const session = startLoopbackCallbackServer({
      expectedState: "expected-state",
      timeoutMs: 5_000,
    })
    const result = session.result.catch((error: unknown) => error)

    const callbackResponse = await fetch(
      `${session.redirectUri}?code=authorization-sensitive&state=wrong-state`,
    )

    expect(callbackResponse.status).toBe(400)
    expect(await result).toBeInstanceOf(Error)
    expect((await result as Error).message).toBe(
      "OAuth callback state did not match",
    )
    await session.close()
  })
})
