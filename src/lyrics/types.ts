export interface LyricsTrackIdentity {
  title: string
  artist: string
  album: string | null
  durationSeconds: number
  spotifyTrackId: string | null
}

export interface SyncedLyricsLine {
  atMs: number
  text: string
}

export type LyricsResult =
  | { kind: "synced"; lines: readonly SyncedLyricsLine[]; source: string }
  | { kind: "plain"; text: string; source: string }

export interface LyricsProvider {
  readonly id: string
  getLyrics: (
    track: LyricsTrackIdentity,
    signal?: AbortSignal,
  ) => Promise<LyricsResult | null>
}

export type LyricsStatus = "idle" | "loading" | "ready" | "unavailable"

export interface LyricsViewState {
  status: LyricsStatus
  trackKey: string | null
  result: LyricsResult | null
}
