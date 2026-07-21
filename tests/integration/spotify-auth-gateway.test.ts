import { describe, expect, mock, test } from "bun:test"

import {
  AuthService,
  REQUIRED_SPOTIFY_SCOPES,
  type TokenEndpointClient,
} from "../../src/auth/auth-service"
import { MemorySecretStore } from "../../src/auth/secret-store"
import { SpotifyAuthGateway } from "../../src/auth/spotify-auth-gateway"
import type { TokenGrant } from "../../src/auth/token-manager"

const REFRESHED_GRANT: TokenGrant = {
  accessToken: "access-refreshed-sensitive",
  expiresInSeconds: 3_600,
  refreshToken: null,
  scope: REQUIRED_SPOTIFY_SCOPES.join(" "),
  tokenType: "Bearer",
}

describe("SpotifyAuthGateway restart restoration", () => {
  test("refreshes a persisted credential and verifies its stable account identity", async () => {
    const refreshAccessToken = mock(() =>
      Promise.resolve(REFRESHED_GRANT),
    )
    const secretStore = new MemorySecretStore({
      accountId: "account-stable",
      refreshToken: "refresh-persisted-sensitive",
      authorizedAt: "2026-07-19T00:00:00.000Z",
    })
    const observed: { authorizationHeader: string | null } = {
      authorizationHeader: null,
    }
    const tokenClient = createTokenClient(refreshAccessToken)
    const gateway = new SpotifyAuthGateway({
      authService: new AuthService({ tokenClient }),
      tokenClient,
      secretStore,
      fetch: (_input, init) => {
        observed.authorizationHeader = new Headers(init?.headers).get(
          "Authorization",
        )
        return Promise.resolve(
          Response.json({
            account_id: "account-stable",
            display_name: "Listener",
            type: "user",
            uri: "spotify:user:legacy-id",
          }),
        )
      },
    })

    const identity = await gateway.restore("client12345")

    expect(identity).toEqual({
      accountId: "account-stable",
      displayName: "Listener",
    })
    expect(refreshAccessToken).toHaveBeenCalledWith(
      "client12345",
      "refresh-persisted-sensitive",
      undefined,
    )
    expect(observed.authorizationHeader).toBe(
      "Bearer access-refreshed-sensitive",
    )
    expect(JSON.stringify(identity)).not.toContain("sensitive")
  })

  test("clears a restored session that predates required feature scopes", async () => {
    const secretStore = new MemorySecretStore({
      accountId: "account-stable",
      refreshToken: "refresh-old",
      authorizedAt: "2026-07-19T00:00:00.000Z",
    })
    const tokenClient = createTokenClient(() =>
      Promise.resolve({
        ...REFRESHED_GRANT,
        scope: "user-read-private",
      }),
    )
    const gateway = new SpotifyAuthGateway({
      authService: new AuthService({ tokenClient }),
      tokenClient,
      secretStore,
    })

    let caught: unknown
    try {
      await gateway.restore("client12345")
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe(
      "Spotify authorization must be renewed",
    )
    expect(await secretStore.getSession()).toBeNull()
  })
})

function createTokenClient(
  refreshAccessToken: TokenEndpointClient["refreshAccessToken"],
): TokenEndpointClient {
  return {
    exchangeAuthorizationCode: () =>
      Promise.resolve(REFRESHED_GRANT),
    refreshAccessToken,
  }
}
