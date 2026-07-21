import type {
  LibrarySnapshot,
  MediaItem,
  Page,
  PlaylistSummary,
  QueueSnapshot,
} from "./types"
import {
  SpotifyApiError,
  SpotifyRateLimitError,
} from "../spotify/errors"

export type LoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error"

export interface DiscoveryNotice {
  key: string
  message: string
  tone: "success" | "warning" | "error"
}

export interface SearchViewState {
  query: string
  status: LoadStatus
  page: Page<MediaItem>
  recentQueries: readonly string[]
  error: string | null
}

export interface QueueViewState {
  status: LoadStatus
  snapshot: QueueSnapshot
  error: string | null
}

export interface LibraryViewState {
  status: LoadStatus
  snapshot: LibrarySnapshot
  activePlaylist: PlaylistSummary | null
  playlistItems: Page<MediaItem>
  playlistStatus: LoadStatus
  error: string | null
}

export interface DiscoveryViewState {
  search: SearchViewState
  queue: QueueViewState
  library: LibraryViewState
  notice: DiscoveryNotice | null
}

export interface DiscoveryRemote {
  searchTracks: (
    query: string,
    offset?: number,
    signal?: AbortSignal,
  ) => Promise<Page<MediaItem>>
  getQueue: (signal?: AbortSignal) => Promise<QueueSnapshot>
  getSavedTracks: (
    offset?: number,
    signal?: AbortSignal,
  ) => Promise<Page<MediaItem>>
  getPlaylists: (
    offset?: number,
    signal?: AbortSignal,
  ) => Promise<Page<PlaylistSummary>>
  getPlaylistItems: (
    playlistId: string,
    offset?: number,
    signal?: AbortSignal,
  ) => Promise<Page<MediaItem>>
  playUris: (
    uris: readonly string[],
    deviceId?: string,
    signal?: AbortSignal,
  ) => Promise<void>
  playContext: (
    contextUri: string,
    offsetUri?: string,
    deviceId?: string,
    signal?: AbortSignal,
  ) => Promise<void>
  addToQueue: (
    uri: string,
    deviceId?: string,
    signal?: AbortSignal,
  ) => Promise<void>
  saveToLibrary: (
    uri: string,
    signal?: AbortSignal,
  ) => Promise<void>
  addToPlaylist: (
    playlistId: string,
    uri: string,
    signal?: AbortSignal,
  ) => Promise<void>
}

export interface DiscoveryControllerPort {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => DiscoveryViewState
  setSearchQuery: (query: string) => void
  searchPage: (direction: -1 | 1) => void
  refreshQueue: () => Promise<void>
  refreshLibrary: () => Promise<void>
  libraryPage: (
    section: "liked" | "playlists",
    direction: -1 | 1,
  ) => void
  openPlaylist: (playlist: PlaylistSummary) => Promise<void>
  playlistPage: (direction: -1 | 1) => void
  closePlaylist: () => void
  playItem: (item: MediaItem, deviceId?: string) => Promise<boolean>
  playPlaylist: (
    playlist: PlaylistSummary,
    item?: MediaItem,
    deviceId?: string,
  ) => Promise<boolean>
  queueItem: (item: MediaItem, deviceId?: string) => Promise<boolean>
  saveItem: (item: MediaItem) => Promise<boolean>
  addItemToPlaylist: (
    item: MediaItem,
    playlist: PlaylistSummary,
  ) => Promise<boolean>
  clearNotice: () => void
  stop: () => void
  whenIdle: () => Promise<void>
}

export interface DiscoveryControllerOptions {
  remote: DiscoveryRemote
  debounceMs?: number
  setTimer?: (
    callback: () => void,
    milliseconds: number,
  ) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
  onPlaybackChanged?: () => void
}

const emptyPage = <T>(): Page<T> => ({
  items: [],
  limit: 0,
  offset: 0,
  total: 0,
  hasNext: false,
  hasPrevious: false,
})

const INITIAL_STATE: DiscoveryViewState = {
  search: {
    query: "",
    status: "idle",
    page: emptyPage(),
    recentQueries: [],
    error: null,
  },
  queue: {
    status: "idle",
    snapshot: {
      currentlyPlaying: null,
      items: [],
    },
    error: null,
  },
  library: {
    status: "idle",
    snapshot: {
      likedTracks: emptyPage(),
      playlists: emptyPage(),
    },
    activePlaylist: null,
    playlistItems: emptyPage(),
    playlistStatus: "idle",
    error: null,
  },
  notice: null,
}

export class DiscoveryController implements DiscoveryControllerPort {
  private readonly remote: DiscoveryRemote
  private readonly debounceMs: number
  private readonly setTimer: NonNullable<
    DiscoveryControllerOptions["setTimer"]
  >
  private readonly clearTimer: NonNullable<
    DiscoveryControllerOptions["clearTimer"]
  >
  private readonly onPlaybackChanged: () => void
  private readonly listeners = new Set<() => void>()
  private readonly work = new Set<Promise<unknown>>()
  private state = INITIAL_STATE
  private searchTimer: ReturnType<typeof setTimeout> | null = null
  private searchAbort: AbortController | null = null
  private queueAbort: AbortController | null = null
  private libraryAbort: AbortController | null = null
  private playlistAbort: AbortController | null = null
  private searchGeneration = 0

  constructor({
    remote,
    debounceMs = 300,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    onPlaybackChanged = () => void 0,
  }: DiscoveryControllerOptions) {
    this.remote = remote
    this.debounceMs = debounceMs
    this.setTimer = setTimer
    this.clearTimer = clearTimer
    this.onPlaybackChanged = onPlaybackChanged
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): DiscoveryViewState => this.state

  setSearchQuery(query: string): void {
    const normalized = query.slice(0, 200)
    this.cancelSearch()
    this.searchGeneration += 1
    this.setState({
      ...this.state,
      search: {
        ...this.state.search,
        query: normalized,
        status: normalized.trim().length === 0 ? "idle" : "loading",
        page: normalized.trim().length === 0
          ? emptyPage()
          : this.state.search.page,
        error: null,
      },
      notice: null,
    })
    if (normalized.trim().length === 0) {
      return
    }
    const generation = this.searchGeneration
    this.searchTimer = this.setTimer(() => {
      this.searchTimer = null
      void this.track(
        this.performSearch(normalized.trim(), 0, generation),
      )
    }, this.debounceMs)
  }

  searchPage(direction: -1 | 1): void {
    const { query, page } = this.state.search
    if (
      query.trim().length === 0 ||
      (direction === 1 && !page.hasNext) ||
      (direction === -1 && !page.hasPrevious)
    ) {
      return
    }
    this.cancelSearch()
    this.searchGeneration += 1
    const generation = this.searchGeneration
    const nextOffset = Math.max(
      0,
      page.offset + direction * Math.max(1, page.limit || 10),
    )
    this.setState({
      ...this.state,
      search: {
        ...this.state.search,
        status: "loading",
        error: null,
      },
    })
    void this.track(
      this.performSearch(query.trim(), nextOffset, generation),
    )
  }

  refreshQueue(): Promise<void> {
    this.queueAbort?.abort()
    this.queueAbort = new AbortController()
    const signal = this.queueAbort.signal
    this.setState({
      ...this.state,
      queue: {
        ...this.state.queue,
        status: "loading",
        error: null,
      },
    })
    return this.track(
      this.remote
        .getQueue(signal)
        .then((snapshot) => {
          if (signal.aborted) {
            return
          }
          this.setState({
            ...this.state,
            queue: {
              status:
                snapshot.currentlyPlaying === null &&
                snapshot.items.length === 0
                  ? "empty"
                  : "ready",
              snapshot,
              error: null,
            },
          })
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return
          }
          this.setState({
            ...this.state,
            queue: {
              ...this.state.queue,
              status: "error",
              error: describeError(error),
            },
          })
        }),
    )
  }

  refreshLibrary(): Promise<void> {
    this.libraryAbort?.abort()
    this.libraryAbort = new AbortController()
    const signal = this.libraryAbort.signal
    const likedOffset = this.state.library.snapshot.likedTracks.offset
    const playlistsOffset = this.state.library.snapshot.playlists.offset
    this.setState({
      ...this.state,
      library: {
        ...this.state.library,
        status: "loading",
        error: null,
      },
    })
    return this.track(
      Promise.all([
        this.remote.getSavedTracks(likedOffset, signal),
        this.remote.getPlaylists(playlistsOffset, signal),
      ])
        .then(([likedTracks, playlists]) => {
          if (signal.aborted) {
            return
          }
          this.setState({
            ...this.state,
            library: {
              ...this.state.library,
              status:
                likedTracks.items.length === 0 &&
                playlists.items.length === 0
                  ? "empty"
                  : "ready",
              snapshot: { likedTracks, playlists },
              error: null,
            },
          })
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return
          }
          this.setState({
            ...this.state,
            library: {
              ...this.state.library,
              status: "error",
              error: describeError(error),
            },
          })
        }),
    )
  }

  libraryPage(
    section: "liked" | "playlists",
    direction: -1 | 1,
  ): void {
    const page =
      section === "liked"
        ? this.state.library.snapshot.likedTracks
        : this.state.library.snapshot.playlists
    if (
      (direction === 1 && !page.hasNext) ||
      (direction === -1 && !page.hasPrevious)
    ) {
      return
    }
    const nextOffset = Math.max(
      0,
      page.offset + direction * Math.max(1, page.limit || 20),
    )
    this.libraryAbort?.abort()
    this.libraryAbort = new AbortController()
    const signal = this.libraryAbort.signal
    this.setState({
      ...this.state,
      library: {
        ...this.state.library,
        status: "loading",
        error: null,
      },
    })
    const request =
      section === "liked"
        ? this.remote.getSavedTracks(nextOffset, signal)
        : this.remote.getPlaylists(nextOffset, signal)
    void this.track(
      request
        .then((nextPage) => {
          if (signal.aborted) {
            return
          }
          const snapshot =
            section === "liked"
              ? {
                  ...this.state.library.snapshot,
                  likedTracks: nextPage as Page<MediaItem>,
                }
              : {
                  ...this.state.library.snapshot,
                  playlists: nextPage as Page<PlaylistSummary>,
                }
          this.setState({
            ...this.state,
            library: {
              ...this.state.library,
              status: "ready",
              snapshot,
            },
          })
        })
        .catch((error: unknown) => {
          if (!isAbortError(error)) {
            this.setState({
              ...this.state,
              library: {
                ...this.state.library,
                status: "error",
                error: describeError(error),
              },
            })
          }
        }),
    )
  }

  openPlaylist(playlist: PlaylistSummary): Promise<void> {
    this.playlistAbort?.abort()
    this.playlistAbort = new AbortController()
    const signal = this.playlistAbort.signal
    this.setState({
      ...this.state,
      library: {
        ...this.state.library,
        activePlaylist: playlist,
        playlistItems: emptyPage(),
        playlistStatus: "loading",
        error: null,
      },
    })
    return this.track(
      this.remote
        .getPlaylistItems(playlist.id, 0, signal)
        .then((playlistItems) => {
          if (signal.aborted) {
            return
          }
          this.setState({
            ...this.state,
            library: {
              ...this.state.library,
              playlistItems,
              playlistStatus:
                playlistItems.items.length === 0 ? "empty" : "ready",
            },
          })
        })
        .catch((error: unknown) => {
          if (!isAbortError(error)) {
            this.setState({
              ...this.state,
              library: {
                ...this.state.library,
                playlistStatus: "error",
                error: describeError(error),
              },
            })
          }
        }),
    )
  }

  playlistPage(direction: -1 | 1): void {
    const playlist = this.state.library.activePlaylist
    const page = this.state.library.playlistItems
    if (
      playlist === null ||
      (direction === 1 && !page.hasNext) ||
      (direction === -1 && !page.hasPrevious)
    ) {
      return
    }
    const nextOffset = Math.max(
      0,
      page.offset + direction * Math.max(1, page.limit || 20),
    )
    this.playlistAbort?.abort()
    this.playlistAbort = new AbortController()
    const signal = this.playlistAbort.signal
    this.setState({
      ...this.state,
      library: {
        ...this.state.library,
        playlistStatus: "loading",
        error: null,
      },
    })
    void this.track(
      this.remote
        .getPlaylistItems(playlist.id, nextOffset, signal)
        .then((playlistItems) => {
          if (!signal.aborted) {
            this.setState({
              ...this.state,
              library: {
                ...this.state.library,
                playlistItems,
                playlistStatus:
                  playlistItems.items.length === 0
                    ? "empty"
                    : "ready",
              },
            })
          }
        })
        .catch((error: unknown) => {
          if (!isAbortError(error)) {
            this.setState({
              ...this.state,
              library: {
                ...this.state.library,
                playlistStatus: "error",
                error: describeError(error),
              },
            })
          }
        }),
    )
  }

  closePlaylist(): void {
    this.playlistAbort?.abort()
    this.playlistAbort = null
    this.setState({
      ...this.state,
      library: {
        ...this.state.library,
        activePlaylist: null,
        playlistItems: emptyPage(),
        playlistStatus: "idle",
        error: null,
      },
    })
  }

  playItem(item: MediaItem, deviceId?: string): Promise<boolean> {
    if (item.uri === null || !item.isPlayable) {
      this.showUnavailable(item)
      return Promise.resolve(false)
    }
    const uri = item.uri
    return this.runAction(
      () => this.remote.playUris([uri], deviceId),
      `Playing ${item.title}.`,
      true,
    )
  }

  playPlaylist(
    playlist: PlaylistSummary,
    item?: MediaItem,
    deviceId?: string,
  ): Promise<boolean> {
    return this.runAction(
      () =>
        this.remote.playContext(
          playlist.uri,
          item?.uri ?? undefined,
          deviceId,
        ),
      `Playing ${playlist.name}.`,
      true,
    )
  }

  async queueItem(
    item: MediaItem,
    deviceId?: string,
  ): Promise<boolean> {
    if (item.uri === null || !item.isPlayable) {
      this.showUnavailable(item)
      return false
    }
    const uri = item.uri
    const succeeded = await this.runAction(
      () => this.remote.addToQueue(uri, deviceId),
      `Added ${item.title} to the queue.`,
      false,
    )
    if (!succeeded) {
      return false
    }
    const optimisticItems = [...this.state.queue.snapshot.items, item]
    this.setState({
      ...this.state,
      queue: {
        status: "ready",
        snapshot: {
          ...this.state.queue.snapshot,
          items: optimisticItems,
        },
        error: null,
      },
    })
    await this.refreshQueue()
    const hasQueuedItem = this.state.queue.snapshot.items.some(
      (candidate) => candidate.uri === item.uri,
    )
    if (!hasQueuedItem || this.state.queue.status === "error") {
      this.setState({
        ...this.state,
        queue: {
          status: "ready",
          snapshot: {
            ...this.state.queue.snapshot,
            items: hasQueuedItem
              ? this.state.queue.snapshot.items
              : [...this.state.queue.snapshot.items, item],
          },
          error: null,
        },
      })
    }
    return true
  }

  saveItem(item: MediaItem): Promise<boolean> {
    if (item.uri === null) {
      this.showUnavailable(item)
      return Promise.resolve(false)
    }
    const uri = item.uri
    return this.runAction(
      () => this.remote.saveToLibrary(uri),
      `Saved ${item.title} to your Spotify library.`,
      false,
    )
  }

  addItemToPlaylist(
    item: MediaItem,
    playlist: PlaylistSummary,
  ): Promise<boolean> {
    if (item.uri === null) {
      this.showUnavailable(item)
      return Promise.resolve(false)
    }
    const uri = item.uri
    return this.runAction(
      () =>
        this.remote.addToPlaylist(
          playlist.id,
          uri,
        ),
      `Added ${item.title} to ${playlist.name}.`,
      false,
    )
  }

  clearNotice(): void {
    if (this.state.notice !== null) {
      this.setState({ ...this.state, notice: null })
    }
  }

  stop(): void {
    this.cancelSearch()
    this.queueAbort?.abort()
    this.libraryAbort?.abort()
    this.playlistAbort?.abort()
  }

  async whenIdle(): Promise<void> {
    while (this.work.size > 0) {
      await Promise.all(this.work)
    }
  }

  private async performSearch(
    query: string,
    offset: number,
    generation: number,
  ): Promise<void> {
    const controller = new AbortController()
    this.searchAbort = controller
    const signal = controller.signal
    try {
      const page = await this.remote.searchTracks(query, offset, signal)
      if (signal.aborted || generation !== this.searchGeneration) {
        return
      }
      const recentQueries = [
        query,
        ...this.state.search.recentQueries.filter(
          (recent) => recent.toLowerCase() !== query.toLowerCase(),
        ),
      ].slice(0, 6)
      this.setState({
        ...this.state,
        search: {
          query,
          status: page.items.length === 0 ? "empty" : "ready",
          page,
          recentQueries,
          error: null,
        },
      })
    } catch (error) {
      if (
        isAbortError(error) ||
        signal.aborted ||
        generation !== this.searchGeneration
      ) {
        return
      }
      this.setState({
        ...this.state,
        search: {
          ...this.state.search,
          status: "error",
          error: describeError(error),
        },
      })
    } finally {
      if (this.searchAbort === controller) {
        this.searchAbort = null
      }
    }
  }

  private runAction(
    action: () => Promise<void>,
    successMessage: string,
    playbackChanged: boolean,
  ): Promise<boolean> {
    return this.track(
      action()
        .then(() => {
          this.setState({
            ...this.state,
            notice: {
              key: `success:${successMessage}`,
              message: successMessage,
              tone: "success",
            },
          })
          if (playbackChanged) {
            this.onPlaybackChanged()
          }
          return true
        })
        .catch((error: unknown) => {
          this.setState({
            ...this.state,
            notice: {
              key: `error:${describeError(error)}`,
              message: describeError(error),
              tone: "error",
            },
          })
          return false
        }),
    )
  }

  private showUnavailable(item: MediaItem): void {
    this.setState({
      ...this.state,
      notice: {
        key: `unavailable:${item.uri ?? item.title}`,
        message: `${item.title} is unavailable for Web API playback.`,
        tone: "warning",
      },
    })
  }

  private cancelSearch(): void {
    if (this.searchTimer !== null) {
      this.clearTimer(this.searchTimer)
      this.searchTimer = null
    }
    this.searchAbort?.abort()
    this.searchAbort = null
  }

  private track<T>(promise: Promise<T>): Promise<T> {
    this.work.add(promise)
    void promise.finally(() => {
      this.work.delete(promise)
    })
    return promise
  }

  private setState(state: DiscoveryViewState): void {
    this.state = state
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export function createStaticDiscoveryController(
  state: DiscoveryViewState = INITIAL_STATE,
): DiscoveryControllerPort {
  return {
    subscribe: () => () => void 0,
    getSnapshot: () => state,
    setSearchQuery: () => void 0,
    searchPage: () => void 0,
    refreshQueue: () => Promise.resolve(),
    refreshLibrary: () => Promise.resolve(),
    libraryPage: () => void 0,
    openPlaylist: () => Promise.resolve(),
    playlistPage: () => void 0,
    closePlaylist: () => void 0,
    playItem: () => Promise.resolve(true),
    playPlaylist: () => Promise.resolve(true),
    queueItem: () => Promise.resolve(true),
    saveItem: () => Promise.resolve(true),
    addItemToPlaylist: () => Promise.resolve(true),
    clearNotice: () => void 0,
    stop: () => void 0,
    whenIdle: () => Promise.resolve(),
  }
}

function describeError(error: unknown): string {
  if (error instanceof SpotifyRateLimitError) {
    return `Spotify is rate limiting requests. Retry in ${String(Math.ceil(error.retryAfterMs / 1_000))}s.`
  }
  if (error instanceof SpotifyApiError) {
    if (error.status === 403) {
      return error.message.toLowerCase().includes("premium")
        ? "Spotify Premium is required for this action."
        : "Spotify denied this action. Reconnect if library or playlist permissions changed."
    }
    if (error.status === 404) {
      return "No active Spotify device is available for this action."
    }
    return `Spotify error: ${error.message}`
  }
  return "Spotify could not be reached. Check the connection and try again."
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  )
}
