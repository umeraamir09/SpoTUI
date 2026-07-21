import { useState, useSyncExternalStore } from "react"

import type { ArtworkControllerPort } from "../../artwork/artwork-service"
import type { ArtworkViewState } from "../../artwork/types"
import type { LayoutMode } from "../layout/layout"
import { useAppTheme } from "../theme/theme-context"
import "../renderables/vinyl-frame"

export interface VinylDeckProps {
  mode: Exclude<LayoutMode, "too-small">
  state: ArtworkViewState
  terminalHeight: number
}

const DISABLED_ARTWORK_STATE: ArtworkViewState = {
  frame: null,
  message: "Artwork rendering is disabled.",
  rotating: false,
  sourceKey: null,
  staticFrame: null,
  status: "unavailable",
}

type ArtworkPresentation = "album" | "vinyl"

export function ConnectedVinylDeck({
  controller,
  enabled,
  mode,
  terminalHeight,
}: {
  controller: ArtworkControllerPort
  enabled: boolean
  mode: Exclude<LayoutMode, "too-small">
  terminalHeight: number
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  )
  return (
    <VinylDeck
      mode={mode}
      state={enabled ? state : DISABLED_ARTWORK_STATE}
      terminalHeight={terminalHeight}
    />
  )
}

export function VinylDeck({
  mode,
  state,
  terminalHeight,
}: VinylDeckProps) {
  const theme = useAppTheme()
  const [presentation, setPresentation] =
    useState<ArtworkPresentation>("album")
  const togglePresentation = () => {
    setPresentation((current) =>
      current === "album" ? "vinyl" : "album",
    )
  }
  if (mode === "compact") {
    return (
      <CompactVinylDeck
        state={state}
        terminalHeight={terminalHeight}
        presentation={presentation}
        onToggle={togglePresentation}
      />
    )
  }

  return (
    <box
      backgroundColor={theme.colors.background}
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width={mode === "large" ? "44%" : "38%"}
      minWidth={28}
      flexShrink={0}
      padding={0}
    >
      <VinylContent
        state={state}
        compact={false}
        presentation={presentation}
        onToggle={togglePresentation}
      />
    </box>
  )
}

function CompactVinylDeck({
  state,
  terminalHeight,
  presentation,
  onToggle,
}: {
  state: ArtworkViewState
  terminalHeight: number
  presentation: ArtworkPresentation
  onToggle: () => void
}) {
  const theme = useAppTheme()
  const constrained = terminalHeight < 19
  return (
    <box
      backgroundColor={theme.colors.background}
      height={constrained ? 1 : 4}
      paddingX={constrained ? 0 : 1}
      flexDirection="row"
      alignItems="center"
      gap={1}
    >
      <VinylContent
        state={state}
        compact
        presentation={presentation}
        onToggle={onToggle}
      />
      <box flexDirection="column" flexGrow={1}>
        <text fg={theme.colors.accentSecondary}>
          <strong>COMPACT VINYL</strong>
        </text>
      </box>
    </box>
  )
}

function VinylContent({
  state,
  compact,
  presentation,
  onToggle,
}: {
  state: ArtworkViewState
  compact: boolean
  presentation: ArtworkPresentation
  onToggle: () => void
}) {
  const theme = useAppTheme()
  const frame = presentation === "album"
    ? (state.staticFrame ?? state.frame)
    : state.frame
  if (state.status === "ready" && frame !== null) {
    const height = compact ? Math.min(frame.height, 3) : frame.height
    return (
      <box
        id="artwork-toggle"
        flexShrink={0}
        onMouseDown={(event) => {
          if (event.button === 0) {
            event.stopPropagation()
            onToggle()
          }
        }}
      >
        <vinyl-frame
          id={presentation === "album" ? "album-art" : "vinyl-art"}
          width={frame.width}
          height={height}
          frame={frame}
          flexShrink={0}
        />
      </box>
    )
  }

  if (compact) {
    return <text fg={theme.colors.accent}>{compactFallback(state)}</text>
  }

  return (
    <box
      id="artwork-toggle"
      flexDirection="column"
      alignItems="center"
      onMouseDown={(event) => {
        if (event.button === 0) {
          event.stopPropagation()
          onToggle()
        }
      }}
    >
      {ASCII_RECORD.map((line, index) => (
        <text
          key={`${String(index)}:${line}`}
          fg={
            index === 3
              ? theme.colors.accent
              : theme.colors.accentSecondary
          }
        >
          {line}
        </text>
      ))}
    </box>
  )
}

const ASCII_RECORD = [
  "      .----------.      ",
  "   .-'////////////'-.   ",
  "  / //// //////// //// \\  ",
  " | /////////.///////// | ",
  "  \\ //// //////// //// /  ",
  "   '-.////////////.-'   ",
  "      '----------'      ",
] as const

function compactFallback(state: ArtworkViewState): string {
  return state.status === "loading" ? "( tuning )" : "( ///./// )"
}
