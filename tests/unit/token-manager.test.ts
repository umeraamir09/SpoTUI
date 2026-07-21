import { describe, expect, mock, test } from "bun:test"

import {
  MemorySecretStore,
  type StoredAuthSession,
} from "../../src/auth/secret-store"
import {
  OAuthTokenError,
  ReauthorizationRequiredError,
  TokenManager,
  type TokenGrant,
} from "../../src/auth/token-manager"

const STORED_SESSION: StoredAuthSession = {
  accountId: "account-stable",
  refreshToken: "refresh-original",
  authorizedAt: "2026-07-19T00:00:00.000Z",
}

const REFRESHED_GRANT: TokenGrant = {
  accessToken: "access-new",
  expiresInSeconds: 3_600,
  refreshToken: null,
  scope: "user-read-private",
  tokenType: "Bearer",
}

describe("TokenManager", () => {
  test("serializes concurrent refreshes and keeps the existing refresh token", async () => {
    const secretStore = new MemorySecretStore(STORED_SESSION)
    const refresh = mock(() => Promise.resolve(REFRESHED_GRANT))
    const manager = new TokenManager({
      clientId: "client-id",
      secretStore,
      refresh,
      now: () => 1_000,
    })

    await manager.restore()
    const [first, second] = await Promise.all([
      manager.getAccessToken({ forceRefresh: true }),
      manager.getAccessToken({ forceRefresh: true }),
    ])

    expect(first).toBe("access-new")
    expect(second).toBe("access-new")
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(await secretStore.getSession()).toEqual(STORED_SESSION)
  })

  test("persists a rotated refresh token after authorization", async () => {
    const secretStore = new MemorySecretStore()
    const manager = new TokenManager({
      clientId: "client-id",
      secretStore,
      refresh: () => Promise.resolve(REFRESHED_GRANT),
      now: () => Date.parse("2026-07-19T00:00:00.000Z"),
    })

    manager.acceptAuthorization({
      ...REFRESHED_GRANT,
      refreshToken: "refresh-rotated",
    })
    await manager.commitAccount("account-stable")

    expect(await secretStore.getSession()).toEqual({
      accountId: "account-stable",
      refreshToken: "refresh-rotated",
      authorizedAt: "2026-07-19T00:00:00.000Z",
    })
  })

  test("tracks the scopes granted to the current access token", () => {
    const manager = new TokenManager({
      clientId: "client-id",
      secretStore: new MemorySecretStore(),
      refresh: () => Promise.resolve(REFRESHED_GRANT),
    })
    manager.acceptAuthorization({
      ...REFRESHED_GRANT,
      refreshToken: "refresh-token",
      scope: "user-read-private user-library-read",
    })

    expect(
      manager.hasScopes(["user-read-private", "user-library-read"]),
    ).toBe(true)
    expect(manager.hasScopes(["playlist-read-private"])).toBe(false)
  })

  test("clears an expired/revoked refresh token and requires reauthorization", async () => {
    const secretStore = new MemorySecretStore(STORED_SESSION)
    const manager = new TokenManager({
      clientId: "client-id",
      secretStore,
      refresh: () =>
        Promise.reject(
          new OAuthTokenError("invalid_grant", "Refresh expired"),
        ),
      now: () => 1_000,
    })

    let caught: unknown
    try {
      await manager.restore()
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ReauthorizationRequiredError)
    expect(await secretStore.getSession()).toBeNull()
  })
})
