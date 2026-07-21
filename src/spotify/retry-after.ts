const DEFAULT_RETRY_AFTER_MS = 1_000
const MAX_RETRY_AFTER_MS = 5 * 60 * 1_000

export function parseRetryAfterMs(
  value: string | null,
  nowMs = Date.now(),
): number {
  if (value === null) {
    return DEFAULT_RETRY_AFTER_MS
  }

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(
      Math.ceil(seconds * 1_000),
      MAX_RETRY_AFTER_MS,
    )
  }

  const dateMs = Date.parse(value)
  if (Number.isFinite(dateMs)) {
    return Math.min(
      Math.max(0, dateMs - nowMs),
      MAX_RETRY_AFTER_MS,
    )
  }

  return DEFAULT_RETRY_AFTER_MS
}

