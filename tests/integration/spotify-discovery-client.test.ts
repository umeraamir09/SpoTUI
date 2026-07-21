import { describe, expect, test } from "bun:test"

import { SpotifyClient } from "../../src/spotify/client"

describe("Spotify Phase 4 client", () => {
  test("uses current search, queue, library, and playlist item endpoints", async () => {
    const requests: { url: string; init: RequestInit }[] = []
    const responses: Response[] = [
      json({
        tracks: {
          items: [track("search")],
          limit: 10,
          offset: 0,
          total: 1,
          next: null,
          previous: null,
        },
      }),
      json({
        currently_playing: track("playing"),
        queue: [track("queued")],
      }),
      json({
        items: [{ added_at: "2026-07-20T00:00:00Z", track: track("liked") }],
        limit: 20,
        offset: 0,
        total: 1,
        next: null,
        previous: null,
      }),
      json({
        items: [
          {
            id: "playlist",
            uri: "spotify:playlist:playlist",
            name: "Signals",
            public: false,
            external_urls: {
              spotify: "https://open.spotify.com/playlist/playlist",
            },
            owner: { id: "owner", display_name: "Owner" },
            items: { total: 1 },
          },
        ],
        limit: 20,
        offset: 0,
        total: 1,
        next: null,
        previous: null,
      }),
      json({
        items: [{ item: track("playlist-item") }],
        limit: 20,
        offset: 0,
        total: 1,
        next: null,
        previous: null,
      }),
    ]
    const client = new SpotifyClient({
      tokenProvider: {
        getAccessToken: () => Promise.resolve("token"),
      },
      fetch: (url, init) => {
        requests.push({ url: requestUrl(url), init: init ?? {} })
        return Promise.resolve(responses.shift() ?? new Response(null))
      },
    })

    expect((await client.searchTracks("warm signal")).items[0]?.title).toBe(
      "Track search",
    )
    expect((await client.getQueue()).items[0]?.title).toBe(
      "Track queued",
    )
    expect((await client.getSavedTracks()).items[0]?.title).toBe(
      "Track liked",
    )
    expect((await client.getPlaylists()).items[0]?.name).toBe("Signals")
    expect(
      (await client.getPlaylistItems("playlist")).items[0]?.title,
    ).toBe("Track playlist-item")

    expect(requests.map((request) => request.url)).toEqual([
      "https://api.spotify.com/v1/search?q=warm+signal&type=track&limit=10&offset=0",
      "https://api.spotify.com/v1/me/player/queue",
      "https://api.spotify.com/v1/me/tracks?limit=20&offset=0",
      "https://api.spotify.com/v1/me/playlists?limit=20&offset=0",
      "https://api.spotify.com/v1/playlists/playlist/items?limit=20&offset=0&additional_types=track%2Cepisode",
    ])
  })

  test("sends current play, queue, save-library, and playlist write contracts", async () => {
    const requests: { url: string; init: RequestInit }[] = []
    const client = new SpotifyClient({
      tokenProvider: {
        getAccessToken: () => Promise.resolve("token"),
      },
      fetch: (url, init) => {
        requests.push({ url: requestUrl(url), init: init ?? {} })
        return Promise.resolve(new Response(null, { status: 204 }))
      },
    })

    await client.playUris(["spotify:track:one"], "device")
    await client.playContext(
      "spotify:playlist:list",
      "spotify:track:two",
      "device",
    )
    await client.addToQueue("spotify:track:three", "device")
    await client.saveToLibrary("spotify:track:four")
    await client.addToPlaylist("list", "spotify:track:five")

    expect(requests.map(({ url, init }) => [url, init.method])).toEqual([
      ["https://api.spotify.com/v1/me/player/play?device_id=device", "PUT"],
      ["https://api.spotify.com/v1/me/player/play?device_id=device", "PUT"],
      [
        "https://api.spotify.com/v1/me/player/queue?uri=spotify%3Atrack%3Athree&device_id=device",
        "POST",
      ],
      [
        "https://api.spotify.com/v1/me/library?uris=spotify%3Atrack%3Afour",
        "PUT",
      ],
      ["https://api.spotify.com/v1/playlists/list/items", "POST"],
    ])
    expect(requests[0]?.init.body).toBe(
      JSON.stringify({ uris: ["spotify:track:one"] }),
    )
    expect(requests[1]?.init.body).toBe(
      JSON.stringify({
        context_uri: "spotify:playlist:list",
        offset: { uri: "spotify:track:two" },
      }),
    )
    expect(requests[4]?.init.body).toBe(
      JSON.stringify({ uris: ["spotify:track:five"] }),
    )
  })
})

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

function requestUrl(value: RequestInfo | URL): string {
  return typeof value === "string"
    ? value
    : value instanceof URL
      ? value.href
      : value.url
}

function track(id: string) {
  return {
    type: "track",
    id,
    uri: `spotify:track:${id}`,
    name: `Track ${id}`,
    duration_ms: 180_000,
    explicit: false,
    is_local: false,
    is_playable: true,
    external_urls: {
      spotify: `https://open.spotify.com/track/${id}`,
    },
    artists: [{ name: "Artist" }],
    album: { name: "Album" },
  }
}
