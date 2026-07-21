import { z } from "zod"

import {
  SpotifyApiError,
  SpotifyRateLimitError,
  SpotifyResponseValidationError,
} from "./errors"
import {
  currentUserProfileSchema,
  devicesResponseSchema,
  playlistItemsResponseSchema,
  playlistsResponseSchema,
  playbackStateSchema,
  queueResponseSchema,
  savedTracksResponseSchema,
  searchTracksResponseSchema,
  type CurrentUserProfile,
} from "./schemas"
import { parseRetryAfterMs } from "./retry-after"
import type {
  PlaybackDevice,
  PlaybackSnapshot,
  RepeatState,
} from "../playback/types"
import type {
  MediaItem,
  Page,
  PlaylistSummary,
  QueueSnapshot,
} from "../discovery/types"
import type { FetchLike } from "../shared/http"

const API_BASE_URL = "https://api.spotify.com/v1"

const regularErrorSchema = z.object({
  error: z.object({
    status: z.number().int(),
    message: z.string(),
  }),
})

export interface TokenProvider {
  getAccessToken: (options?: {
    forceRefresh?: boolean
    signal?: AbortSignal
  }) => Promise<string>
}

export interface SpotifyClientOptions {
  tokenProvider: TokenProvider
  fetch?: FetchLike
  delay?: (milliseconds: number, signal?: AbortSignal) => Promise<void>
  now?: () => number
}

function defaultDelay(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds)
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException("The operation was aborted", "AbortError"))
    }
    signal?.addEventListener("abort", abort, { once: true })
  })
}

export class SpotifyClient {
  private readonly tokenProvider: TokenProvider
  private readonly fetchImplementation: FetchLike
  private readonly delay: (
    milliseconds: number,
    signal?: AbortSignal,
  ) => Promise<void>
  private readonly now: () => number

  constructor({
    tokenProvider,
    fetch: fetchImplementation = fetch,
    delay = defaultDelay,
    now = Date.now,
  }: SpotifyClientOptions) {
    this.tokenProvider = tokenProvider
    this.fetchImplementation = fetchImplementation
    this.delay = delay
    this.now = now
  }

  getCurrentUserProfile(
    signal?: AbortSignal,
  ): Promise<CurrentUserProfile> {
    return this.requestJson("/me", currentUserProfileSchema, signal)
  }

  getPlaybackState(
    signal?: AbortSignal,
  ): Promise<PlaybackSnapshot | null> {
    return this.requestOptionalJson(
      "/me/player?additional_types=track%2Cepisode",
      playbackStateSchema,
      signal,
    )
  }

  getDevices(signal?: AbortSignal): Promise<PlaybackDevice[]> {
    return this.requestJson(
      "/me/player/devices",
      devicesResponseSchema,
      signal,
    )
  }

  searchTracks(
    query: string,
    offset = 0,
    signal?: AbortSignal,
  ): Promise<Page<MediaItem>> {
    return this.requestJson(
      withQuery("/search", {
        q: query,
        type: "track",
        limit: "10",
        offset: String(Math.max(0, offset)),
      }),
      searchTracksResponseSchema,
      signal,
    )
  }

  getQueue(signal?: AbortSignal): Promise<QueueSnapshot> {
    return this.requestJson(
      "/me/player/queue",
      queueResponseSchema,
      signal,
    )
  }

  getSavedTracks(
    offset = 0,
    signal?: AbortSignal,
  ): Promise<Page<MediaItem>> {
    return this.requestJson(
      withQuery("/me/tracks", {
        limit: "20",
        offset: String(Math.max(0, offset)),
      }),
      savedTracksResponseSchema,
      signal,
    )
  }

  getPlaylists(
    offset = 0,
    signal?: AbortSignal,
  ): Promise<Page<PlaylistSummary>> {
    return this.requestJson(
      withQuery("/me/playlists", {
        limit: "20",
        offset: String(Math.max(0, offset)),
      }),
      playlistsResponseSchema,
      signal,
    )
  }

  getPlaylistItems(
    playlistId: string,
    offset = 0,
    signal?: AbortSignal,
  ): Promise<Page<MediaItem>> {
    return this.requestJson(
      withQuery(
        `/playlists/${encodeURIComponent(playlistId)}/items`,
        {
          limit: "20",
          offset: String(Math.max(0, offset)),
          additional_types: "track,episode",
        },
      ),
      playlistItemsResponseSchema,
      signal,
    )
  }

  play(deviceId?: string, signal?: AbortSignal): Promise<void> {
    return this.requestVoid(
      withQuery("/me/player/play", { device_id: deviceId }),
      { method: "PUT" },
      signal,
    )
  }

  playUris(
    uris: readonly string[],
    deviceId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.requestVoid(
      withQuery("/me/player/play", { device_id: deviceId }),
      {
        method: "PUT",
        body: JSON.stringify({ uris }),
        headers: {
          "Content-Type": "application/json",
        },
      },
      signal,
    )
  }

  playContext(
    contextUri: string,
    offsetUri?: string,
    deviceId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.requestVoid(
      withQuery("/me/player/play", { device_id: deviceId }),
      {
        method: "PUT",
        body: JSON.stringify({
          context_uri: contextUri,
          ...(offsetUri === undefined
            ? {}
            : { offset: { uri: offsetUri } }),
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
      signal,
    )
  }

  addToQueue(
    uri: string,
    deviceId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.requestVoid(
      withQuery("/me/player/queue", {
        uri,
        device_id: deviceId,
      }),
      { method: "POST" },
      signal,
    )
  }

  saveToLibrary(
    uri: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.requestVoid(
      withQuery("/me/library", { uris: uri }),
      { method: "PUT" },
      signal,
    )
  }

  addToPlaylist(
    playlistId: string,
    uri: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.requestVoid(
      `/playlists/${encodeURIComponent(playlistId)}/items`,
      {
        method: "POST",
        body: JSON.stringify({ uris: [uri] }),
        headers: {
          "Content-Type": "application/json",
        },
      },
      signal,
    )
  }

  pause(deviceId?: string, signal?: AbortSignal): Promise<void> {
    return this.requestVoid(
      withQuery("/me/player/pause", { device_id: deviceId }),
      { method: "PUT" },
      signal,
    )
  }

  next(deviceId?: string, signal?: AbortSignal): Promise<void> {
    return this.requestVoid(
      withQuery("/me/player/next", { device_id: deviceId }),
      { method: "POST" },
      signal,
    )
  }

  previous(deviceId?: string, signal?: AbortSignal): Promise<void> {
    return this.requestVoid(
      withQuery("/me/player/previous", { device_id: deviceId }),
      { method: "POST" },
      signal,
    )
  }

  seek(
    positionMs: number,
    deviceId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.requestVoid(
      withQuery("/me/player/seek", {
        position_ms: String(Math.max(0, Math.round(positionMs))),
        device_id: deviceId,
      }),
      { method: "PUT" },
      signal,
    )
  }

  setVolume(
    volumePercent: number,
    deviceId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.requestVoid(
      withQuery("/me/player/volume", {
        volume_percent: String(
          Math.min(100, Math.max(0, Math.round(volumePercent))),
        ),
        device_id: deviceId,
      }),
      { method: "PUT" },
      signal,
    )
  }

  setShuffle(
    enabled: boolean,
    deviceId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.requestVoid(
      withQuery("/me/player/shuffle", {
        state: String(enabled),
        device_id: deviceId,
      }),
      { method: "PUT" },
      signal,
    )
  }

  setRepeat(
    state: RepeatState,
    deviceId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.requestVoid(
      withQuery("/me/player/repeat", {
        state,
        device_id: deviceId,
      }),
      { method: "PUT" },
      signal,
    )
  }

  transferPlayback(
    deviceId: string,
    play: boolean,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.requestVoid(
      "/me/player",
      {
        method: "PUT",
        body: JSON.stringify({
          device_ids: [deviceId],
          play,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
      signal,
    )
  }

  private async requestJson<T>(
    path: string,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const response = await this.send(path, {}, signal)
    const payload: unknown = await response.json().catch(() => null)
    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      throw new SpotifyResponseValidationError()
    }

    return parsed.data
  }

  private async requestOptionalJson<T>(
    path: string,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ): Promise<T | null> {
    const response = await this.send(path, {}, signal)
    if (response.status === 204) {
      return null
    }

    const payload: unknown = await response.json().catch(() => null)
    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      throw new SpotifyResponseValidationError()
    }

    return parsed.data
  }

  private async requestVoid(
    path: string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.send(path, init, signal)
  }

  private async send(
    path: string,
    init: RequestInit,
    signal?: AbortSignal,
    refreshed = false,
    rateLimitRetried = false,
  ): Promise<Response> {
    if (!path.startsWith("/")) {
      throw new Error("Spotify API paths must be relative")
    }

    const accessToken = await this.tokenProvider.getAccessToken({
      ...(refreshed ? { forceRefresh: true } : {}),
      ...(signal === undefined ? {} : { signal }),
    })
    const response = await this.fetchImplementation(
      `${API_BASE_URL}${path}`,
      {
        ...init,
        headers: {
          Accept: "application/json",
          ...headersToRecord(init.headers),
          Authorization: `Bearer ${accessToken}`,
        },
        ...(signal === undefined ? {} : { signal }),
      },
    )

    if (response.status === 401 && !refreshed) {
      return this.send(path, init, signal, true, rateLimitRetried)
    }

    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(
        response.headers.get("Retry-After"),
        this.now(),
      )
      if (!rateLimitRetried) {
        await this.delay(retryAfterMs, signal)
        return this.send(path, init, signal, refreshed, true)
      }
      throw new SpotifyRateLimitError(retryAfterMs)
    }

    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null)
      const parsedError = regularErrorSchema.safeParse(payload)
      throw new SpotifyApiError(
        response.status,
        parsedError.success
          ? parsedError.data.error.message
          : "Spotify request failed",
      )
    }

    return response
  }
}

function withQuery(
  path: string,
  values: Readonly<Record<string, string | undefined>>,
): string {
  const query = new URLSearchParams()
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) {
      query.set(name, value)
    }
  }
  const serialized = query.toString()
  return serialized.length === 0 ? path : `${path}?${serialized}`
}

function headersToRecord(
  headers: HeadersInit | undefined,
): Record<string, string> {
  return Object.fromEntries(new Headers(headers).entries())
}
