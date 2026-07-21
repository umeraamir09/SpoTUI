import { parseLrc } from "./normalize"
import type { FetchLike } from "../shared/http"
import type { LyricsProvider, LyricsResult, LyricsTrackIdentity } from "./types"

interface LrcLibResponse {
  syncedLyrics?: unknown
  plainLyrics?: unknown
}

export interface LrcLibProviderOptions {
  fetch?: FetchLike
}

export class LrcLibProvider implements LyricsProvider {
  readonly id = "lrclib"
  private readonly fetchImplementation: FetchLike

  constructor({ fetch: fetchImplementation = fetch }: LrcLibProviderOptions = {}) {
    this.fetchImplementation = fetchImplementation
  }

  async getLyrics(
    track: LyricsTrackIdentity,
    signal?: AbortSignal,
  ): Promise<LyricsResult | null> {
    const query = new URLSearchParams({
      track_name: track.title,
      artist_name: track.artist,
      duration: String(Math.max(0, Math.round(track.durationSeconds))),
    })
    if (track.album !== null && track.album.trim().length > 0) {
      query.set("album_name", track.album)
    }
    const response = await this.fetchImplementation(
      `https://lrclib.net/api/get?${query.toString()}`,
      {
        headers: { Accept: "application/json" },
        ...(signal === undefined ? {} : { signal }),
      },
    )
    if (response.status === 404) {
      return null
    }
    if (!response.ok) {
      throw new Error(`LRCLIB returned ${String(response.status)}`)
    }
    const payload = await response.json() as LrcLibResponse
    const synced = typeof payload.syncedLyrics === "string" ? payload.syncedLyrics : ""
    const lines = parseLrc(synced)
    if (lines.length > 0) {
      return { kind: "synced", lines, source: "LRCLIB" }
    }
    const plain = typeof payload.plainLyrics === "string" ? payload.plainLyrics.trim() : ""
    return plain.length > 0 ? { kind: "plain", text: plain, source: "LRCLIB" } : null
  }
}
