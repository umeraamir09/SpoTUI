import { describe, expect, mock, test } from "bun:test"

import {
  AuthService,
  REQUIRED_SPOTIFY_SCOPES,
} from "../../src/auth/auth-service"
import type {
  LoopbackCallbackSession,
} from "../../src/auth/callback-server"
import type { TokenGrant } from "../../src/auth/token-manager"

const GRANT: TokenGrant = {
  accessToken: "access-sensitive",
  expiresInSeconds: 3_600,
  refreshToken: "refresh-sensitive",
  scope: REQUIRED_SPOTIFY_SCOPES.join(" "),
  tokenType: "Bearer",
}

describe("AuthService", () => {
  test("opens a PKCE authorization URL and exchanges the callback code", async () => {
    let openedUrl: URL | undefined
    let expectedState: string | undefined
    const callbackReady = mock(() => undefined)
    const exchange = mock(() => Promise.resolve(GRANT))
    const callback: LoopbackCallbackSession = {
      redirectUri: "http://127.0.0.1:43123/callback",
      result: Promise.resolve({ code: "authorization-sensitive" }),
      close: () => Promise.resolve(),
    }
    const service = new AuthService({
      startCallback: (options) => {
        expectedState = options.expectedState
        return callback
      },
      openUrl: (url) => {
        openedUrl = new URL(url)
        return Promise.resolve()
      },
      tokenClient: {
        exchangeAuthorizationCode: exchange,
        refreshAccessToken: () => Promise.resolve(GRANT),
      },
      createVerifier: () => "verifier-value",
      createChallenge: () => Promise.resolve("challenge-value"),
      createState: () => "state-value",
    })

    const grant = await service.authorize(
      "client123",
      undefined,
      callbackReady,
    )

    expect(grant).toEqual(GRANT)
    expect(expectedState).toBe("state-value")
    expect(callbackReady).toHaveBeenCalledWith(callback.redirectUri)
    expect(openedUrl?.origin).toBe("https://accounts.spotify.com")
    expect(openedUrl?.pathname).toBe("/authorize")
    expect(openedUrl?.searchParams.get("redirect_uri")).toBe(
      callback.redirectUri,
    )
    expect(openedUrl?.searchParams.get("code_challenge_method")).toBe(
      "S256",
    )
    expect(openedUrl?.searchParams.get("scope")).toBe(
      REQUIRED_SPOTIFY_SCOPES.join(" "),
    )
    expect(exchange).toHaveBeenCalledWith(
      "client123",
      "authorization-sensitive",
      callback.redirectUri,
      "verifier-value",
      undefined,
    )
  })
})
