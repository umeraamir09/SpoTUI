import type {
  BoxRenderable,
  MouseEvent as OpenTuiMouseEvent,
} from "@opentui/core"
import { useEffect, useRef, useState } from "react"

import {
  getInterpolatedProgressMs,
  type ProgressAnchor,
} from "../../playback/progress-clock"
import { createProgressBar, formatDuration } from "../../shared/format"
import { useAppTheme } from "../theme/theme-context"

export function ProgressBar({
  progress,
  durationMs,
  width,
  focused,
  onSeek,
  liveUpdates,
}: {
  progress: ProgressAnchor | null
  durationMs: number
  width: number
  focused: boolean
  onSeek: (positionMs: number) => void
  liveUpdates: boolean
}) {
  const theme = useAppTheme()
  const progressMs = useVisibleProgress(progress, liveUpdates)
  const [dragPosition, setDragPosition] = useState<number | null>(
    null,
  )
  const dragging = useRef(false)
  const track = useRef<BoxRenderable | null>(null)
  const shownProgress = dragPosition ?? progressMs

  const positionFromMouse = (
    event: OpenTuiMouseEvent,
  ): number => {
    const renderable = track.current
    if (renderable === null || renderable.width <= 1) {
      return 0
    }
    const offset = Math.min(
      renderable.width - 1,
      Math.max(0, event.x - renderable.screenX),
    )
    return Math.round(
      (offset / (renderable.width - 1)) * durationMs,
    )
  }

  return (
    <box
      id="focus-progress"
      focusable
      focused={focused}
      height={1}
      width="100%"
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      gap={1}
      backgroundColor={
        focused
          ? theme.colors.surfaceRaised
          : theme.colors.background
      }
    >
      <text fg={theme.colors.textMuted}>
        {formatDuration(shownProgress)}
      </text>
      <box
        ref={track}
        id="progress-track"
        height={1}
        width={width}
        onMouseDown={(event) => {
          if (event.button !== 0) {
            return
          }
          event.stopPropagation()
          dragging.current = true
          setDragPosition(positionFromMouse(event))
        }}
        onMouseDrag={(event) => {
          if (!dragging.current) {
            return
          }
          event.stopPropagation()
          setDragPosition(positionFromMouse(event))
        }}
        onMouseUp={(event) => {
          if (!dragging.current) {
            return
          }
          event.stopPropagation()
          const position = positionFromMouse(event)
          dragging.current = false
          setDragPosition(null)
          onSeek(position)
        }}
        onMouseOut={() => {
          if (!dragging.current) {
            setDragPosition(null)
          }
        }}
      >
        <text fg={theme.colors.accent}>
          {createProgressBar(shownProgress, durationMs, width, {
            complete: theme.glyphs.progressComplete,
            remaining: theme.glyphs.progressRemaining,
          })}
        </text>
      </box>
      <text fg={theme.colors.textMuted}>
        {formatDuration(durationMs)}
      </text>
    </box>
  )
}

function useVisibleProgress(
  progress: ProgressAnchor | null,
  liveUpdates: boolean,
): number {
  const [nowMs, setNowMs] = useState(
    () => progress?.receivedAtMs ?? Date.now(),
  )

  useEffect(() => {
    setNowMs(progress?.receivedAtMs ?? Date.now())
    if (progress?.isPlaying !== true || !liveUpdates) {
      return
    }
    const timer = setInterval(() => {
      setNowMs(Date.now())
    }, 1_000)
    return () => {
      clearInterval(timer)
    }
  }, [
    liveUpdates,
    progress?.isPlaying,
    progress?.itemKey,
    progress?.receivedAtMs,
  ])

  return progress === null
    ? 0
    : getInterpolatedProgressMs(progress, nowMs)
}
