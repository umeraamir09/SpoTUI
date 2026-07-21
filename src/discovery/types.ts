export type MediaItemKind = "track" | "episode"

export interface MediaItem {
  kind: MediaItemKind
  id: string | null
  uri: string | null
  title: string
  artists: string[]
  album: string | null
  durationMs: number
  explicit: boolean
  isLocal: boolean
  isPlayable: boolean
  spotifyUrl: string | null
}

export interface Page<T> {
  items: T[]
  limit: number
  offset: number
  total: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface QueueSnapshot {
  currentlyPlaying: MediaItem | null
  items: MediaItem[]
}

export interface PlaylistSummary {
  id: string
  uri: string
  name: string
  owner: string
  totalItems: number
  isPublic: boolean | null
  spotifyUrl: string | null
}

export interface LibrarySnapshot {
  likedTracks: Page<MediaItem>
  playlists: Page<PlaylistSummary>
}
