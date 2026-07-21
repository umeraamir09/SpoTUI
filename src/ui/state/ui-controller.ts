export type UiFocusTarget =
  | "transport"
  | "progress"
  | "volume"
  | "devices"

export type UiToastTone =
  | "info"
  | "success"
  | "warning"
  | "error"

export interface UiToast {
  id: string
  key: string
  message: string
  tone: UiToastTone
}

export interface UiViewState {
  focusTarget: UiFocusTarget
  toasts: readonly UiToast[]
}

export interface ShowToastOptions {
  key: string
  message: string
  tone: UiToastTone
  durationMs?: number
}

export interface UiControllerPort {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => UiViewState
  setFocusTargets: (targets: readonly UiFocusTarget[]) => void
  focusNext: () => void
  focusPrevious: () => void
  showToast: (options: ShowToastOptions) => void
  dismissToast: (id: string) => void
  stop: () => void
}

export interface UiControllerOptions {
  maxToasts?: number
  setTimer?: (
    callback: () => void,
    milliseconds: number,
  ) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
}

const DEFAULT_FOCUS_TARGETS: readonly UiFocusTarget[] = [
  "transport",
  "progress",
  "volume",
  "devices",
]

export class UiController implements UiControllerPort {
  private readonly maxToasts: number
  private readonly setTimer: NonNullable<UiControllerOptions["setTimer"]>
  private readonly clearTimer: NonNullable<
    UiControllerOptions["clearTimer"]
  >
  private readonly listeners = new Set<() => void>()
  private readonly toastTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >()

  private focusTargets = DEFAULT_FOCUS_TARGETS
  private state: UiViewState = {
    focusTarget: "transport",
    toasts: [],
  }
  private nextToastId = 0

  constructor({
    maxToasts = 3,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  }: UiControllerOptions = {}) {
    if (!Number.isInteger(maxToasts) || maxToasts <= 0) {
      throw new Error("Toast capacity must be positive")
    }
    this.maxToasts = maxToasts
    this.setTimer = setTimer
    this.clearTimer = clearTimer
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): UiViewState => this.state

  setFocusTargets(targets: readonly UiFocusTarget[]): void {
    if (targets.length === 0) {
      throw new Error("At least one visible focus target is required")
    }
    this.focusTargets = [...new Set(targets)]
    if (!this.focusTargets.includes(this.state.focusTarget)) {
      this.setState({
        ...this.state,
        focusTarget: this.focusTargets[0] ?? "transport",
      })
    }
  }

  focusNext(): void {
    this.moveFocus(1)
  }

  focusPrevious(): void {
    this.moveFocus(-1)
  }

  showToast({
    key,
    message,
    tone,
    durationMs = defaultToastDuration(tone),
  }: ShowToastOptions): void {
    const duplicate = this.state.toasts.find(
      (toast) => toast.key === key,
    )
    if (duplicate !== undefined) {
      this.clearToastTimer(duplicate.id)
    }

    this.nextToastId += 1
    const toast: UiToast = {
      id: `toast-${String(this.nextToastId)}`,
      key,
      message,
      tone,
    }
    const withoutDuplicate = this.state.toasts.filter(
      (candidate) => candidate.key !== key,
    )
    const nextToasts = [...withoutDuplicate, toast].slice(
      -this.maxToasts,
    )
    const retainedIds = new Set(nextToasts.map((candidate) => candidate.id))
    for (const candidate of this.state.toasts) {
      if (!retainedIds.has(candidate.id)) {
        this.clearToastTimer(candidate.id)
      }
    }
    this.setState({ ...this.state, toasts: nextToasts })

    const timer = this.setTimer(() => {
      this.toastTimers.delete(toast.id)
      this.removeToast(toast.id)
    }, Math.max(250, durationMs))
    this.toastTimers.set(toast.id, timer)
  }

  dismissToast(id: string): void {
    this.clearToastTimer(id)
    this.removeToast(id)
  }

  stop(): void {
    for (const timer of this.toastTimers.values()) {
      this.clearTimer(timer)
    }
    this.toastTimers.clear()
    if (this.state.toasts.length > 0) {
      this.setState({ ...this.state, toasts: [] })
    }
  }

  private moveFocus(direction: -1 | 1): void {
    const currentIndex = this.focusTargets.indexOf(
      this.state.focusTarget,
    )
    const baseIndex = currentIndex < 0 ? 0 : currentIndex
    const nextIndex =
      (baseIndex + direction + this.focusTargets.length) %
      this.focusTargets.length
    const focusTarget =
      this.focusTargets[nextIndex] ?? this.focusTargets[0] ?? "transport"
    if (focusTarget !== this.state.focusTarget) {
      this.setState({ ...this.state, focusTarget })
    }
  }

  private removeToast(id: string): void {
    const toasts = this.state.toasts.filter(
      (toast) => toast.id !== id,
    )
    if (toasts.length !== this.state.toasts.length) {
      this.setState({ ...this.state, toasts })
    }
  }

  private clearToastTimer(id: string): void {
    const timer = this.toastTimers.get(id)
    if (timer !== undefined) {
      this.clearTimer(timer)
      this.toastTimers.delete(id)
    }
  }

  private setState(state: UiViewState): void {
    this.state = state
    for (const listener of this.listeners) {
      listener()
    }
  }
}

function defaultToastDuration(tone: UiToastTone): number {
  return tone === "error" ? 6_000 : 3_000
}
