import type { PlaybackItem } from "../playback/types"
import { getLyricsCacheKey } from "./normalize"
import type { LyricsProvider, LyricsResult, LyricsTrackIdentity, LyricsViewState } from "./types"

const INITIAL_STATE: LyricsViewState = { status: "idle", trackKey: null, result: null }

export interface LyricsControllerPort {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => LyricsViewState
  load: (item: PlaybackItem | null) => void
  stop: () => void
  whenIdle: () => Promise<void>
}

export class LyricsController implements LyricsControllerPort {
  private readonly providers: readonly LyricsProvider[]
  private readonly listeners = new Set<() => void>()
  private readonly cache = new Map<string, LyricsResult | null>()
  private state = INITIAL_STATE
  private request: AbortController | null = null
  private work: Promise<void> | null = null

  constructor({ providers }: { providers: readonly LyricsProvider[] }) {
    this.providers = providers
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): LyricsViewState => this.state

  load(item: PlaybackItem | null): void {
    const track = item?.kind === "track" ? toTrackIdentity(item) : null
    const key = track === null ? null : getLyricsCacheKey(track)
    if (key === this.state.trackKey && this.state.status !== "idle") {
      return
    }
    this.request?.abort()
    this.request = null
    if (track === null || key === null) {
      this.setState(INITIAL_STATE)
      return
    }
    const cached = this.cache.get(key)
    if (cached !== undefined) {
      this.setState({ status: cached === null ? "unavailable" : "ready", trackKey: key, result: cached })
      return
    }
    const request = new AbortController()
    this.request = request
    this.setState({ status: "loading", trackKey: key, result: null })
    const work = this.fetch(track, key, request).finally(() => {
      if (this.request === request) this.request = null
      if (this.work === work) this.work = null
    })
    this.work = work
  }

  stop(): void {
    this.request?.abort()
    this.request = null
    if (this.state.status === "loading") {
      this.setState({ status: "idle", trackKey: null, result: null })
    }
  }

  whenIdle(): Promise<void> {
    return this.work ?? Promise.resolve()
  }

  private async fetch(track: LyricsTrackIdentity, key: string, request: AbortController): Promise<void> {
    let result: LyricsResult | null = null
    for (const provider of this.providers) {
      try {
        result = await provider.getLyrics(track, request.signal)
        if (result !== null) break
      } catch (error) {
        if (isAbortError(error)) return
      }
    }
    if (request.signal.aborted || this.request !== request) return
    this.cache.set(key, result)
    this.setState({ status: result === null ? "unavailable" : "ready", trackKey: key, result })
  }

  private setState(state: LyricsViewState): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }
}

export function createStaticLyricsController(state: LyricsViewState = INITIAL_STATE): LyricsControllerPort {
  return { subscribe: () => () => void 0, getSnapshot: () => state, load: () => void 0, stop: () => void 0, whenIdle: () => Promise.resolve() }
}

function toTrackIdentity(item: PlaybackItem): LyricsTrackIdentity {
  return { title: item.title, artist: item.artists[0] ?? "", album: item.album, durationSeconds: item.durationMs / 1_000, spotifyTrackId: item.id }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}
