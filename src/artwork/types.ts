export interface DecodedImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

export const ARTWORK_TRANSPARENT_COLOR = 0xffff
export const ARTWORK_CHARACTER_EMPTY = 0
export const ARTWORK_CHARACTER_UPPER_HALF = 1
export const ARTWORK_CHARACTER_LOWER_HALF = 2

export interface ArtworkFrameStats {
  artworkPixels: number
  centerHolePixels: number
}

export interface ArtworkFrame {
  width: number
  height: number
  angleRadians: number
  characters: Uint8Array
  foreground: Uint16Array
  background: Uint16Array
  mask: Uint8Array
  stats: ArtworkFrameStats
}

export type ArtworkStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unavailable"
  | "error"

export interface ArtworkViewState {
  status: ArtworkStatus
  sourceKey: string | null
  staticFrame: ArtworkFrame | null
  frame: ArtworkFrame | null
  rotating: boolean
  message: string | null
}

export interface ArtworkRequest {
  key: string
  url: string | null
  width: number
  height: number
  isPlaying: boolean
  animations: boolean
}

export interface ArtworkBytes {
  bytes: Uint8Array
  mimeType: string | null
}
