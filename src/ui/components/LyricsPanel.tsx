import { useEffect, useState } from "react"

import { getInterpolatedProgressMs, type ProgressAnchor } from "../../playback/progress-clock"
import { getActiveLyricsLineIndex } from "../../lyrics/normalize"
import type { LyricsViewState } from "../../lyrics/types"
import { useAppTheme } from "../theme/theme-context"

export function LyricsPanel({
  lyrics,
  progress,
  liveUpdates,
  manualOffset,
}: {
  lyrics: LyricsViewState
  progress: ProgressAnchor | null
  liveUpdates: boolean
  manualOffset: number | null
}) {
  const theme = useAppTheme()
  const now = useLyricsClock(progress, liveUpdates)
  if (lyrics.status === "idle") {
    return <text fg={theme.colors.textMuted}>Start a track to view lyrics.</text>
  }
  if (lyrics.status === "loading") {
    return <text fg={theme.colors.accentSecondary}>TUNING LYRICS...</text>
  }
  if (lyrics.result === null) {
    return <text fg={theme.colors.textMuted}>Lyrics unavailable for this track.</text>
  }
  if (lyrics.result.kind === "plain") {
    const lines = lyrics.result.text.split(/\r?\n/u)
    const start = Math.max(0, Math.min(Math.max(0, lines.length - 4), manualOffset ?? 0))
    return (
      <>
        {lines.slice(start, start + 4).map((line, index) => (
          <text key={`${String(start + index)}:${line}`} fg={theme.colors.textSecondary}>{line || " "}</text>
        ))}
        <text fg={theme.colors.textMuted}>{manualOffset === null ? "Plain lyrics" : "Manual scroll"} / {lyrics.result.source}</text>
      </>
    )
  }

  const active = getActiveLyricsLineIndex(
    lyrics.result.lines,
    progress === null ? 0 : getInterpolatedProgressMs(progress, now),
  )
  const center = manualOffset ?? Math.max(0, active)
  const start = Math.max(0, Math.min(Math.max(0, lyrics.result.lines.length - 4), center - 1))
  return (
    <>
      {lyrics.result.lines.slice(start, start + 4).map((line, relativeIndex) => {
        const index = start + relativeIndex
        const current = index === active
        return (
          <text key={`${String(line.atMs)}:${line.text}`} fg={current ? theme.colors.accent : theme.colors.textSecondary}>
            {current ? `${theme.glyphs.statusReady} ` : "  "}{line.text || "..."}
          </text>
        )
      })}
      <text fg={theme.colors.textMuted}>
        {manualOffset === null ? "Following playback" : "Manual scroll - press y to resume"} / {lyrics.result.source}
      </text>
    </>
  )
}

function useLyricsClock(progress: ProgressAnchor | null, liveUpdates: boolean): number {
  const [now, setNow] = useState(() => progress?.receivedAtMs ?? Date.now())
  useEffect(() => {
    setNow(progress?.receivedAtMs ?? Date.now())
    if (!liveUpdates || progress?.isPlaying !== true) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [liveUpdates, progress?.isPlaying, progress?.itemKey, progress?.receivedAtMs])
  return now
}
