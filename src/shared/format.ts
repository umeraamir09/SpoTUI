export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes)}:${String(seconds).padStart(2, "0")}`
}

export function createProgressBar(
  progressMs: number,
  durationMs: number,
  width: number,
  glyphs: {
    complete: string
    remaining: string
  } = {
    complete: "━",
    remaining: "─",
  },
): string {
  const safeWidth = Math.max(1, Math.floor(width))
  const ratio =
    durationMs <= 0
      ? 0
      : Math.min(1, Math.max(0, progressMs / durationMs))
  const completed = Math.round(ratio * safeWidth)
  return `${glyphs.complete.repeat(completed)}${glyphs.remaining.repeat(safeWidth - completed)}`
}
