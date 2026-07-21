import { useEffect, useState } from "react"

import type { PlaybackSnapshot } from "../../playback/types"
import { useAppTheme } from "../theme/theme-context"

export interface SpectrumVisualizerProps {
  playback: PlaybackSnapshot
  width: number
  height: number
  animationsEnabled: boolean
}

interface SpectrumFrameOptions {
  trackKey: string
  phase: number
  width: number
  height: number
  unicode: boolean
}

const FRAME_INTERVAL_MS = 140

export function SpectrumVisualizer({
  playback,
  width,
  height,
  animationsEnabled,
}: SpectrumVisualizerProps) {
  const theme = useAppTheme()
  const trackKey = spectrumTrackKey(playback)
  const phase = useSpectrumPhase(
    trackKey,
    playback.isPlaying,
    animationsEnabled,
  )
  const rows = buildMirroredSpectrum({
    trackKey,
    phase,
    width,
    height,
    unicode: theme.presentation.unicode,
  })
  const halfHeight = rows.length / 2

  return (
    <box
      id="track-spectrum"
      width={width}
      height={rows.length}
      flexDirection="column"
      flexShrink={0}
      alignItems="center"
      justifyContent="center"
      backgroundColor={theme.colors.background}
    >
      {rows.map((row, index) => {
        const distanceFromCenter =
          index < halfHeight
            ? halfHeight - index
            : index - halfHeight + 1
        return (
          <text
            key={String(index)}
            fg={
              playback.isPlaying
                ? distanceFromCenter === halfHeight
                  ? theme.colors.accentSecondary
                  : theme.colors.accent
                : theme.colors.textMuted
            }
          >
            {row}
          </text>
        )
      })}
    </box>
  )
}

export function buildMirroredSpectrum({
  trackKey,
  phase,
  width,
  height,
  unicode,
}: SpectrumFrameOptions): readonly string[] {
  const halfHeight = Math.max(1, Math.floor(height / 2))
  const barCount = Math.max(1, Math.floor((width + 1) / 2))
  const glyph = unicode ? "▮" : "|"
  const amplitudes = createAmplitudes(
    trackKey,
    phase,
    barCount,
    halfHeight,
  )

  return Array.from({ length: halfHeight * 2 }, (_, rowIndex) => {
    const distanceFromCenter =
      rowIndex < halfHeight
        ? halfHeight - rowIndex
        : rowIndex - halfHeight + 1
    const row = amplitudes
      .map((amplitude) =>
        amplitude >= distanceFromCenter ? glyph : " ",
      )
      .join(" ")
    return row.padEnd(width).slice(0, width)
  })
}

function useSpectrumPhase(
  trackKey: string,
  isPlaying: boolean,
  animationsEnabled: boolean,
): number {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    setPhase(0)
    if (!isPlaying || !animationsEnabled) {
      return
    }

    let nextPhase = 0
    const timer = setInterval(() => {
      nextPhase += 1
      setPhase(nextPhase)
    }, FRAME_INTERVAL_MS)

    return () => {
      clearInterval(timer)
    }
  }, [animationsEnabled, isPlaying, trackKey])

  return phase
}

function createAmplitudes(
  trackKey: string,
  phase: number,
  barCount: number,
  halfHeight: number,
): readonly number[] {
  const seed = hashTrackKey(trackKey)
  const seedA = (seed % 31) * 0.17
  const seedB = (seed % 17) * 0.23

  return Array.from({ length: barCount }, (_, index) => {
    const position = barCount <= 1 ? 0 : index / (barCount - 1)
    const primary =
      (Math.sin(index * 0.83 + phase * 0.91 + seedA) + 1) / 2
    const harmonic =
      (Math.sin(index * 1.57 - phase * 1.19 + seedB) + 1) / 2
    const pulse =
      (Math.sin(phase * 0.61 + position * 5.4 + seedA) + 1) / 2
    const envelope =
      0.58 + 0.42 * Math.sin(Math.PI * Math.max(0.08, position))
    const signal =
      (primary * 0.5 + harmonic * 0.32 + pulse * 0.18) * envelope

    const minimumAmplitude = halfHeight === 1 ? 0 : 1
    return Math.min(
      halfHeight,
      Math.max(
        minimumAmplitude,
        Math.round(signal * halfHeight),
      ),
    )
  })
}

function spectrumTrackKey(playback: PlaybackSnapshot): string {
  const item = playback.item
  if (item === null) {
    return "no-track"
  }
  return `${item.kind}:${item.id ?? item.uri ?? item.title}`
}

function hashTrackKey(value: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}
