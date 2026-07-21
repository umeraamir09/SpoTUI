import {
  getInterpolatedProgressMs,
  reconcileProgressAnchor,
  type ProgressAnchor,
} from "./progress-clock"
import {
  cycleRepeatState,
  getPollIntervalMs,
  resolveMuteToggle,
} from "./playback-policy"
import type {
  PlaybackDevice,
  PlaybackNotice,
  PlaybackSnapshot,
  PlaybackStatus,
  RepeatState,
} from "./types"
import {
  SpotifyApiError,
  SpotifyRateLimitError,
} from "../spotify/errors"

const COMMAND_REFRESH_DELAY_MS = 400

export interface PlaybackRemote {
  getPlaybackState: (
    signal?: AbortSignal,
  ) => Promise<PlaybackSnapshot | null>
  getDevices: (signal?: AbortSignal) => Promise<PlaybackDevice[]>
  play: (deviceId?: string, signal?: AbortSignal) => Promise<void>
  pause: (deviceId?: string, signal?: AbortSignal) => Promise<void>
  next: (deviceId?: string, signal?: AbortSignal) => Promise<void>
  previous: (deviceId?: string, signal?: AbortSignal) => Promise<void>
  seek: (
    positionMs: number,
    deviceId?: string,
    signal?: AbortSignal,
  ) => Promise<void>
  setVolume: (
    volumePercent: number,
    deviceId?: string,
    signal?: AbortSignal,
  ) => Promise<void>
  setShuffle: (
    enabled: boolean,
    deviceId?: string,
    signal?: AbortSignal,
  ) => Promise<void>
  setRepeat: (
    state: RepeatState,
    deviceId?: string,
    signal?: AbortSignal,
  ) => Promise<void>
  transferPlayback: (
    deviceId: string,
    play: boolean,
    signal?: AbortSignal,
  ) => Promise<void>
}

export interface PlaybackViewState {
  status: PlaybackStatus
  playback: PlaybackSnapshot | null
  devices: PlaybackDevice[]
  progress: ProgressAnchor | null
  stale: boolean
  notice: PlaybackNotice | null
  pendingCommand: string | null
}

export interface PlaybackControllerPort {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => PlaybackViewState
  start: () => void
  stop: () => void
  refresh: () => Promise<void>
  setTerminalFocused: (focused: boolean) => void
  togglePlayback: () => void
  next: () => void
  previous: () => void
  seekBy: (deltaMs: number) => void
  seekTo: (positionMs: number) => void
  adjustVolume: (deltaPercent: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  transferTo: (deviceId: string, play: boolean) => void
  whenIdle: () => Promise<void>
}

export interface PlaybackControllerOptions {
  remote: PlaybackRemote
  now?: () => number
  setTimer?: (
    callback: () => void,
    milliseconds: number,
  ) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
}

const INITIAL_STATE: PlaybackViewState = {
  status: "idle",
  playback: null,
  devices: [],
  progress: null,
  stale: false,
  notice: null,
  pendingCommand: null,
}

export class PlaybackController implements PlaybackControllerPort {
  private readonly remote: PlaybackRemote
  private readonly now: () => number
  private readonly setTimer: NonNullable<
    PlaybackControllerOptions["setTimer"]
  >
  private readonly clearTimer: NonNullable<
    PlaybackControllerOptions["clearTimer"]
  >
  private readonly listeners = new Set<() => void>()

  private state: PlaybackViewState = INITIAL_STATE
  private started = false
  private terminalFocused = true
  private timer: ReturnType<typeof setTimeout> | null = null
  private requestAbort: AbortController | null = null
  private refreshInFlight: Promise<void> | null = null
  private readonly commandWork = new Set<Promise<void>>()
  private rememberedVolume = 50

  constructor({
    remote,
    now = Date.now,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  }: PlaybackControllerOptions) {
    this.remote = remote
    this.now = now
    this.setTimer = setTimer
    this.clearTimer = clearTimer
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): PlaybackViewState => this.state

  start(): void {
    if (this.started) {
      return
    }
    this.started = true
    void this.refresh()
  }

  stop(): void {
    this.started = false
    this.requestAbort?.abort()
    this.requestAbort = null
    this.clearScheduledTimer()
  }

  refresh(): Promise<void> {
    if (this.refreshInFlight !== null) {
      return this.refreshInFlight
    }

    this.refreshInFlight = this.performRefresh().finally(() => {
      this.refreshInFlight = null
      if (this.started) {
        this.schedulePoll()
      }
    })
    return this.refreshInFlight
  }

  setTerminalFocused(focused: boolean): void {
    this.terminalFocused = focused
    if (this.started) {
      this.schedulePoll()
    }
  }

  togglePlayback(): void {
    const playback = this.state.playback
    const device = this.getControllableDevice()
    if (playback === null || device === null) {
      return
    }

    const nextIsPlaying = !playback.isPlaying
    this.updatePlayback({
      ...playback,
      isPlaying: nextIsPlaying,
    })
    this.enqueueCommand(
      (signal) =>
        nextIsPlaying
          ? this.remote.play(device.id ?? undefined, signal)
          : this.remote.pause(device.id ?? undefined, signal),
    )
  }

  next(): void {
    const device = this.getControllableDevice()
    if (device !== null) {
      this.enqueueCommand((signal) =>
        this.remote.next(device.id ?? undefined, signal),
      )
    }
  }

  previous(): void {
    const device = this.getControllableDevice()
    if (device !== null) {
      this.enqueueCommand((signal) =>
        this.remote.previous(device.id ?? undefined, signal),
      )
    }
  }

  seekBy(deltaMs: number): void {
    const playback = this.state.playback
    if (playback === null) {
      return
    }
    const progress = this.state.progress
    if (progress === null) {
      return
    }
    this.seekTo(
      getInterpolatedProgressMs(progress, this.now()) + deltaMs,
    )
  }

  seekTo(positionMs: number): void {
    const playback = this.state.playback
    const item = playback?.item ?? null
    const device = this.getControllableDevice()
    if (
      playback === null ||
      item === null ||
      device === null ||
      !Number.isFinite(positionMs)
    ) {
      return
    }
    const nextPosition = Math.min(
      item.durationMs,
      Math.max(0, Math.round(positionMs)),
    )
    this.updatePlayback({
      ...playback,
      progressMs: nextPosition,
    })
    this.enqueueCommand((signal) =>
      this.remote.seek(
        nextPosition,
        device.id ?? undefined,
        signal,
      ),
    )
  }

  adjustVolume(deltaPercent: number): void {
    const device = this.getControllableDevice(true)
    if (device === null) {
      return
    }
    const currentVolume = device.volumePercent
    if (currentVolume === null) {
      return
    }
    this.setVolume(currentVolume + deltaPercent, device)
  }

  toggleMute(): void {
    const device = this.getControllableDevice(true)
    if (device === null) {
      return
    }
    const currentVolume = device.volumePercent
    if (currentVolume === null) {
      return
    }
    const resolved = resolveMuteToggle(
      currentVolume,
      this.rememberedVolume,
    )
    this.rememberedVolume = resolved.rememberedVolume
    this.setVolume(resolved.volume, device)
  }

  toggleShuffle(): void {
    const playback = this.state.playback
    const device = this.getControllableDevice()
    if (playback === null || device === null) {
      return
    }
    const enabled = !playback.shuffleState
    this.updatePlayback({ ...playback, shuffleState: enabled })
    this.enqueueCommand((signal) =>
      this.remote.setShuffle(
        enabled,
        device.id ?? undefined,
        signal,
      ),
    )
  }

  cycleRepeat(): void {
    const playback = this.state.playback
    const device = this.getControllableDevice()
    if (playback === null || device === null) {
      return
    }
    const repeatState = cycleRepeatState(playback.repeatState)
    this.updatePlayback({ ...playback, repeatState })
    this.enqueueCommand((signal) =>
      this.remote.setRepeat(
        repeatState,
        device.id ?? undefined,
        signal,
      ),
    )
  }

  transferTo(deviceId: string, play: boolean): void {
    const device = this.state.devices.find(
      (candidate) => candidate.id === deviceId,
    )
    if (device?.id === null || device?.id === undefined) {
      this.setNotice({
        kind: "no-device",
        message: "That Spotify device is no longer available.",
      })
      return
    }
    if (device.isRestricted) {
      this.setNotice({
        kind: "restricted-device",
        message: `${device.name} does not accept Web API controls.`,
      })
      return
    }

    const devices = this.state.devices.map((candidate) => ({
      ...candidate,
      isActive: candidate.id === deviceId,
    }))
    this.setState({
      ...this.state,
      devices,
      notice: null,
    })
    this.enqueueCommand((signal) =>
      this.remote.transferPlayback(deviceId, play, signal),
    )
  }

  async whenIdle(): Promise<void> {
    while (this.commandWork.size > 0) {
      await Promise.all(this.commandWork)
    }
    await (this.refreshInFlight ?? Promise.resolve())
  }

  private async performRefresh(): Promise<void> {
    this.clearScheduledTimer()
    this.requestAbort?.abort()
    this.requestAbort = new AbortController()
    const signal = this.requestAbort.signal
    if (this.state.status === "idle") {
      this.setState({ ...this.state, status: "loading" })
    }

    try {
      const [playback, devices] = await Promise.all([
        this.remote.getPlaybackState(signal),
        this.remote.getDevices(signal),
      ])
      const receivedAtMs = this.now()
      const activeDevice =
        playback?.device ??
        devices.find((device) => device.isActive) ??
        null
      const status: PlaybackStatus =
        playback !== null
          ? "ready"
          : activeDevice === null
            ? "no-device"
            : "nothing-playing"
      const progress =
        playback?.item === null || playback === null
          ? null
          : reconcileProgressAnchor(
              this.state.progress,
              {
                itemKey: `${playback.item.kind}:${playback.item.id ?? playback.item.uri ?? playback.item.title}`,
                progressMs: playback.progressMs,
                durationMs: playback.item.durationMs,
                isPlaying: playback.isPlaying,
              },
              receivedAtMs,
            )

      this.setState({
        status,
        playback,
        devices: includePlaybackDevice(devices, playback?.device),
        progress,
        stale: false,
        notice:
          status === "no-device"
            ? {
                kind: "no-device",
                message:
                  "Open Spotify on a device, or choose an available device.",
              }
            : playback?.device.isRestricted === true
              ? {
                  kind: "restricted-device",
                  message: `${playback.device.name} does not accept Web API controls.`,
                }
              : null,
        pendingCommand: this.state.pendingCommand,
      })
    } catch (error) {
      if (isAbortError(error)) {
        return
      }
      this.setState({
        ...this.state,
        status:
          this.state.playback === null ? "error" : this.state.status,
        stale: this.state.playback !== null,
        notice: classifyPlaybackError(error),
      })
    } finally {
      if (this.requestAbort.signal === signal) {
        this.requestAbort = null
      }
    }
  }

  private getControllableDevice(
    requireVolume = false,
  ): PlaybackDevice | null {
    const device =
      this.state.playback?.device ??
      this.state.devices.find((candidate) => candidate.isActive) ??
      null
    if (device === null) {
      this.setNotice({
        kind: "no-device",
        message: "No active Spotify device. Press d to choose one.",
      })
      return null
    }
    if (device.isRestricted) {
      this.setNotice({
        kind: "restricted-device",
        message: `${device.name} does not accept Web API controls.`,
      })
      return null
    }
    if (requireVolume && !device.supportsVolume) {
      this.setNotice({
        kind: "unsupported-volume",
        message: `${device.name} does not expose volume control.`,
      })
      return null
    }
    return device
  }

  private setVolume(
    requestedVolume: number,
    device: PlaybackDevice,
  ): void {
    const volume = Math.min(100, Math.max(0, Math.round(requestedVolume)))
    const devices = this.state.devices.map((candidate) =>
      candidate.id === device.id
        ? { ...candidate, volumePercent: volume }
        : candidate,
    )
    const playback =
      this.state.playback === null
        ? null
        : {
            ...this.state.playback,
            device: {
              ...this.state.playback.device,
              volumePercent: volume,
            },
          }
    this.setState({
      ...this.state,
      devices,
      playback,
      notice: null,
    })
    this.enqueueCommand((signal) =>
      this.remote.setVolume(
        volume,
        device.id ?? undefined,
        signal,
      ),
    )
  }

  private updatePlayback(playback: PlaybackSnapshot): void {
    const receivedAtMs = this.now()
    const progress =
      playback.item === null
        ? null
        : reconcileProgressAnchor(
            this.state.progress,
            {
              itemKey: `${playback.item.kind}:${playback.item.id ?? playback.item.uri ?? playback.item.title}`,
              progressMs: playback.progressMs,
              durationMs: playback.item.durationMs,
              isPlaying: playback.isPlaying,
            },
            receivedAtMs,
          )
    this.setState({
      ...this.state,
      playback,
      progress,
      notice: null,
    })
  }

  private enqueueCommand(
    action: (signal?: AbortSignal) => Promise<void>,
  ): void {
    const trackedWork = Promise.resolve()
      .then(() => action())
      .then(() => {
        if (this.started) {
          this.scheduleCommandRefresh()
        }
      })
      .catch((error: unknown) => {
        this.setNotice(classifyPlaybackError(error))
      })
      .finally(() => {
        this.commandWork.delete(trackedWork)
      })
    this.commandWork.add(trackedWork)
  }

  private scheduleCommandRefresh(): void {
    this.clearScheduledTimer()
    this.timer = this.setTimer(() => {
      this.timer = null
      void this.refresh()
    }, COMMAND_REFRESH_DELAY_MS)
  }

  private schedulePoll(): void {
    this.clearScheduledTimer()
    const pollingState =
      this.state.playback?.isPlaying === true
        ? "playing"
        : this.state.playback === null
          ? "inactive"
          : "paused"
    this.timer = this.setTimer(() => {
      this.timer = null
      void this.refresh()
    }, getPollIntervalMs(pollingState, this.terminalFocused))
  }

  private clearScheduledTimer(): void {
    if (this.timer !== null) {
      this.clearTimer(this.timer)
      this.timer = null
    }
  }

  private setNotice(notice: PlaybackNotice): void {
    this.setState({
      ...this.state,
      notice,
      pendingCommand: null,
    })
  }

  private setState(state: PlaybackViewState): void {
    this.state = state
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export function createStaticPlaybackController(
  state: PlaybackViewState = INITIAL_STATE,
): PlaybackControllerPort {
  return {
    subscribe: () => () => void 0,
    getSnapshot: () => state,
    start: () => void 0,
    stop: () => void 0,
    refresh: () => Promise.resolve(),
    setTerminalFocused: () => void 0,
    togglePlayback: () => void 0,
    next: () => void 0,
    previous: () => void 0,
    seekBy: () => void 0,
    seekTo: () => void 0,
    adjustVolume: () => void 0,
    toggleMute: () => void 0,
    toggleShuffle: () => void 0,
    cycleRepeat: () => void 0,
    transferTo: () => void 0,
    whenIdle: () => Promise.resolve(),
  }
}

function includePlaybackDevice(
  devices: PlaybackDevice[],
  playbackDevice: PlaybackDevice | undefined,
): PlaybackDevice[] {
  if (
    playbackDevice === undefined ||
    devices.some((device) => device.id === playbackDevice.id)
  ) {
    return devices
  }
  return [playbackDevice, ...devices]
}

function classifyPlaybackError(error: unknown): PlaybackNotice {
  if (error instanceof SpotifyRateLimitError) {
    return {
      kind: "rate-limit",
      message: `Spotify is rate limiting requests. Retry in ${String(Math.ceil(error.retryAfterMs / 1_000))}s.`,
    }
  }
  if (error instanceof SpotifyApiError) {
    if (error.status === 403) {
      const lowerMessage = error.message.toLowerCase()
      return lowerMessage.includes("premium")
        ? {
            kind: "premium-required",
            message: "Spotify Premium is required for playback controls.",
          }
        : {
            kind: "forbidden",
            message:
              "Spotify rejected this control. Check the device and account permissions.",
          }
    }
    if (error.status === 404) {
      return {
        kind: "no-device",
        message: "Spotify could not find an active playback device.",
      }
    }
  }
  return {
    kind: "network",
    message:
      "Spotify could not be reached. Last known playback is marked stale.",
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  )
}
