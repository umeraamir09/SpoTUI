const CORRECTION_DURATION_MS = 500

export interface ProgressAnchor {
  itemKey: string
  reportedProgressMs: number
  durationMs: number
  receivedAtMs: number
  isPlaying: boolean
  correctionFromMs: number
  correctionStartedAtMs: number
}

export interface ProgressReport {
  itemKey: string
  progressMs: number
  durationMs: number
  isPlaying: boolean
}

export function getInterpolatedProgressMs(
  anchor: ProgressAnchor,
  nowMs: number,
): number {
  const elapsedMs = anchor.isPlaying
    ? Math.max(0, nowMs - anchor.receivedAtMs)
    : 0
  const correctionElapsedMs = Math.max(
    0,
    nowMs - anchor.correctionStartedAtMs,
  )
  const correctionRatio = Math.min(
    1,
    correctionElapsedMs / CORRECTION_DURATION_MS,
  )
  const correctionMs =
    anchor.correctionFromMs * (1 - correctionRatio)

  return clampProgress(
    anchor.reportedProgressMs + elapsedMs + correctionMs,
    anchor.durationMs,
  )
}

export function reconcileProgressAnchor(
  previous: ProgressAnchor | null,
  report: ProgressReport,
  receivedAtMs: number,
): ProgressAnchor {
  const matchingPrevious =
    previous !== null && previous.itemKey === report.itemKey
  const visiblePrevious = matchingPrevious
    ? getInterpolatedProgressMs(previous, receivedAtMs)
    : report.progressMs

  return {
    itemKey: report.itemKey,
    reportedProgressMs: clampProgress(
      report.progressMs,
      report.durationMs,
    ),
    durationMs: Math.max(0, report.durationMs),
    receivedAtMs,
    isPlaying: report.isPlaying,
    correctionFromMs: visiblePrevious - report.progressMs,
    correctionStartedAtMs: receivedAtMs,
  }
}

function clampProgress(value: number, durationMs: number): number {
  return Math.min(
    Math.max(0, Math.round(value)),
    Math.max(0, durationMs),
  )
}
