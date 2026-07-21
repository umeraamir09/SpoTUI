import type { LyricsTrackIdentity, SyncedLyricsLine } from "./types"

export function normalizeLyricsPart(value: string | null): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
}

export function getLyricsCacheKey(track: LyricsTrackIdentity): string {
  return [
    normalizeLyricsPart(track.artist),
    normalizeLyricsPart(track.title),
    normalizeLyricsPart(track.album),
    String(Math.max(0, Math.round(track.durationSeconds))),
  ].join("_")
}

export function parseLrc(source: string): SyncedLyricsLine[] {
  const lines: SyncedLyricsLine[] = []
  for (const rawLine of source.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const text = rawLine.replace(/^(?:\[[^\]]+\])+\s*/u, "").trim()
    const timestamps = rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/gu)
    for (const match of timestamps) {
      const minutes = Number(match[1])
      const seconds = Number(match[2])
      const fraction = match[3] ?? "0"
      const fractionMs = Math.round(Number(`0.${fraction}`) * 1_000)
      if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
        lines.push({ atMs: (minutes * 60 + seconds) * 1_000 + fractionMs, text })
      }
    }
  }
  return lines.sort((left, right) => left.atMs - right.atMs)
}

export function getActiveLyricsLineIndex(
  lines: readonly SyncedLyricsLine[],
  progressMs: number,
): number {
  let active = -1
  for (let index = 0; index < lines.length; index += 1) {
    if ((lines[index]?.atMs ?? Infinity) > progressMs) {
      break
    }
    active = index
  }
  return active
}
