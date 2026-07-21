export type RepeatState = "off" | "context" | "track"

export interface PlaybackImage {
  url: string
  width: number | null
  height: number | null
}

export interface PlaybackItem {
  kind: "track" | "episode"
  id: string | null
  uri: string | null
  title: string
  artists: string[]
  album: string | null
  durationMs: number
  imageUrl: string | null
  isLocal: boolean
}

export interface PlaybackDevice {
  id: string | null
  isActive: boolean
  isPrivateSession: boolean
  isRestricted: boolean
  name: string
  type: string
  volumePercent: number | null
  supportsVolume: boolean
}

export interface PlaybackSnapshot {
  device: PlaybackDevice
  repeatState: RepeatState
  shuffleState: boolean
  timestamp: number
  progressMs: number
  isPlaying: boolean
  item: PlaybackItem | null
}

export type PlaybackStatus =
  | "idle"
  | "loading"
  | "ready"
  | "no-device"
  | "nothing-playing"
  | "error"

export type PlaybackNoticeKind =
  | "forbidden"
  | "network"
  | "no-device"
  | "premium-required"
  | "rate-limit"
  | "restricted-device"
  | "unsupported-volume"

export interface PlaybackNotice {
  kind: PlaybackNoticeKind
  message: string
}
