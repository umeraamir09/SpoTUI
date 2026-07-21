import { describe, expect, test } from "bun:test"

import { SpotifyClient } from "../../src/spotify/client"

describe("Spotify playback client", () => {
  test("treats a 204 playback response as nothing active", async () => {
    const client = createClient(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    )

    expect(await client.getPlaybackState()).toBeNull()
  })

  test("normalizes track, device, and full artwork metadata", async () => {
    const client = createClient(() =>
      Promise.resolve(Response.json(playbackPayload())),
    )

    const playback = await client.getPlaybackState()

    expect(playback?.device.name).toBe("Desk Speaker")
    expect(playback?.item?.kind).toBe("track")
    expect(playback?.item?.imageUrl).toBe(
      "https://i.scdn.co/image/cover-large",
    )
  })

  test("sends current endpoint methods, query values, and transfer body", async () => {
    const requests: Request[] = []
    const client = createClient((input, init) => {
      requests.push(new Request(input, init))
      return Promise.resolve(new Response(null, { status: 204 }))
    })

    await client.seek(45_000, "device-active")
    await client.setVolume(65, "device-active")
    await client.setShuffle(true, "device-active")
    await client.setRepeat("context", "device-active")
    await client.transferPlayback("device-other", true)

    expect(requests.map((request) => request.method)).toEqual([
      "PUT",
      "PUT",
      "PUT",
      "PUT",
      "PUT",
    ])
    expect(requests[0]?.url).toContain(
      "/me/player/seek?position_ms=45000&device_id=device-active",
    )
    expect(requests[1]?.url).toContain("volume_percent=65")
    expect(requests[2]?.url).toContain("state=true")
    expect(requests[3]?.url).toContain("state=context")
    expect(await requests[4]?.json()).toEqual({
      device_ids: ["device-other"],
      play: true,
    })
  })

  test("uses the current transport endpoint methods", async () => {
    const requests: Request[] = []
    const client = createClient((input, init) => {
      requests.push(new Request(input, init))
      return Promise.resolve(new Response(null, { status: 204 }))
    })

    await client.play("device-active")
    await client.pause("device-active")
    await client.next("device-active")
    await client.previous("device-active")

    expect(
      requests.map((request) => [
        request.method,
        new URL(request.url).pathname,
      ]),
    ).toEqual([
      ["PUT", "/v1/me/player/play"],
      ["PUT", "/v1/me/player/pause"],
      ["POST", "/v1/me/player/next"],
      ["POST", "/v1/me/player/previous"],
    ])
  })
})

function createClient(
  fetchImplementation: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>,
) {
  return new SpotifyClient({
    tokenProvider: {
      getAccessToken: () => Promise.resolve("access-sensitive"),
    },
    fetch: fetchImplementation,
  })
}

function playbackPayload() {
  return {
    device: {
      id: "device-active",
      is_active: true,
      is_private_session: false,
      is_restricted: false,
      name: "Desk Speaker",
      supports_volume: true,
      type: "speaker",
      volume_percent: 60,
    },
    is_playing: true,
    item: {
      album: {
        images: [
          {
            height: 640,
            url: "https://i.scdn.co/image/cover-large",
            width: 640,
          },
        ],
        name: "Night Signals",
      },
      artists: [{ name: "Signal Unit" }],
      duration_ms: 240_000,
      id: "track-one",
      is_local: false,
      name: "Warm Receiver",
      type: "track",
      uri: "spotify:track:one",
    },
    progress_ms: 30_000,
    repeat_state: "off",
    shuffle_state: false,
    timestamp: 1_000,
  }
}
