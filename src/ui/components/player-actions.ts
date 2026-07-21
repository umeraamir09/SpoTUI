export interface PlayerActions {
  toggleShuffle: () => void
  previous: () => void
  togglePlayback: () => void
  next: () => void
  cycleRepeat: () => void
  seekTo: (positionMs: number) => void
  volumeDown: () => void
  toggleMute: () => void
  volumeUp: () => void
  openDevices: () => void
}
