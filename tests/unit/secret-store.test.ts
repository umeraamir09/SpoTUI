import { describe, expect, test } from "bun:test"

import {
  BunSecretStore,
  SecretStoreCorruptError,
  type StoredAuthSession,
} from "../../src/auth/secret-store"

describe("BunSecretStore", () => {
  test("round-trips the refresh token and stable account identifier", async () => {
    let stored: string | null = null
    const store = new BunSecretStore({
      secrets: {
        get: () => Promise.resolve(stored),
        set: ({ value }) => {
          stored = value
          return Promise.resolve()
        },
        delete: () => {
          stored = null
          return Promise.resolve(true)
        },
      },
    })
    const session: StoredAuthSession = {
      accountId: "account-stable",
      refreshToken: "refresh-sensitive",
      authorizedAt: "2026-07-19T00:00:00.000Z",
    }

    await store.setSession(session)

    expect(await store.getSession()).toEqual(session)
    expect(stored).not.toContain("accessToken")
  })

  test("rejects malformed credential-store data without exposing it", async () => {
    const store = new BunSecretStore({
      secrets: {
        get: () => Promise.resolve("refresh-sensitive"),
        set: () => Promise.resolve(),
        delete: () => Promise.resolve(false),
      },
    })

    let caught: unknown
    try {
      await store.getSession()
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(SecretStoreCorruptError)
    expect(String(caught)).not.toContain("refresh-sensitive")
  })
})
