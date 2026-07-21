import { describe, expect, mock, test } from "bun:test"

import { SpotifyClient } from "../../src/spotify/client"

describe("SpotifyClient", () => {
  test("injects a bearer token, validates /me, and never mutates caller headers", async () => {
    let request: Request | undefined
    const client = new SpotifyClient({
      tokenProvider: {
        getAccessToken: () => Promise.resolve("access-sensitive"),
      },
      fetch: (input, init) => {
        request = new Request(input, init)
        return Promise.resolve(
          Response.json({
            account_id: "account-stable",
            display_name: "Listener",
            id: "legacy-id",
            type: "user",
            uri: "spotify:user:legacy-id",
          }),
        )
      },
    })

    const profile = await client.getCurrentUserProfile()

    expect(profile.accountId).toBe("account-stable")
    expect(request?.url).toBe("https://api.spotify.com/v1/me")
    expect(request?.headers.get("Authorization")).toBe(
      "Bearer access-sensitive",
    )
  })

  test("refreshes once on 401 and replays the request once", async () => {
    const getAccessToken = mock(
      ({ forceRefresh }: { forceRefresh?: boolean } = {}) =>
        Promise.resolve(forceRefresh ? "access-new" : "access-old"),
    )
    let calls = 0
    const client = new SpotifyClient({
      tokenProvider: { getAccessToken },
      fetch: () => {
        calls += 1
        return Promise.resolve(
          calls === 1
            ? Response.json(
                { error: { status: 401, message: "expired" } },
                { status: 401 },
              )
            : Response.json({
                account_id: "account-stable",
                display_name: null,
                type: "user",
                uri: "spotify:user:legacy-id",
              }),
        )
      },
    })

    await client.getCurrentUserProfile()

    expect(calls).toBe(2)
    expect(getAccessToken).toHaveBeenCalledTimes(2)
  })

  test("honors Retry-After before retrying a 429", async () => {
    const waits: number[] = []
    let calls = 0
    const client = new SpotifyClient({
      tokenProvider: {
        getAccessToken: () => Promise.resolve("access-sensitive"),
      },
      fetch: () => {
        calls += 1
        return Promise.resolve(
          calls === 1
            ? new Response(null, {
                status: 429,
                headers: { "Retry-After": "2" },
              })
            : Response.json({
                account_id: "account-stable",
                display_name: "Listener",
                type: "user",
                uri: "spotify:user:legacy-id",
              }),
        )
      },
      delay: (milliseconds) => {
        waits.push(milliseconds)
        return Promise.resolve()
      },
      now: () => 10_000,
    })

    await client.getCurrentUserProfile()

    expect(waits).toEqual([2_000])
    expect(calls).toBe(2)
  })
})

