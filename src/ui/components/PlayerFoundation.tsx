import type { PlaybackViewState } from "../../playback/playback-controller"
import type { LayoutMode } from "../layout/layout"
import type { UiFocusTarget } from "../state/ui-controller"
import { useAppTheme } from "../theme/theme-context"
import { ProgressBar } from "./ProgressBar"
import { SpectrumVisualizer } from "./SpectrumVisualizer"
import { TrackMetadata } from "./TrackMetadata"
import { TransportControls } from "./TransportControls"
import { VolumeControl } from "./VolumeControl"
import type { PlayerActions } from "./player-actions"

export interface PlayerFoundationProps {
  mode: Exclude<LayoutMode, "too-small">
  state: PlaybackViewState
  terminalWidth: number
  focusTarget: UiFocusTarget
  actions: PlayerActions
  animationsEnabled: boolean
  liveProgress: boolean
  showSpectrum: boolean
}

export function PlayerFoundation({
  mode,
  state,
  terminalWidth,
  focusTarget,
  actions,
  animationsEnabled,
  liveProgress,
  showSpectrum,
}: PlayerFoundationProps) {
  const theme = useAppTheme()
  const compact = mode === "compact"
  const narrowCompact = compact && terminalWidth < 60
  const playback = state.playback
  const item = playback?.item ?? null
  const fallbackFocused = focusTarget === "transport"

  if (state.status === "loading" || state.status === "idle") {
    return (
      <FoundationBox compact={compact} focused={fallbackFocused}>
        <text fg={theme.colors.accentSecondary}>
          <strong>TUNING SPOTIFY SIGNAL...</strong>
        </text>
        <text fg={theme.colors.textMuted}>
          Reading playback and Spotify Connect devices.
        </text>
      </FoundationBox>
    )
  }

  if (state.status === "no-device") {
    return (
      <FoundationBox compact={compact} focused={fallbackFocused}>
        <text fg={theme.colors.error}>
          <strong>NO ACTIVE DEVICE</strong>
        </text>
        <text fg={theme.colors.textSecondary}>
          Open Spotify somewhere, or press d to choose a device.
        </text>
        <text fg={theme.colors.textMuted}>
          {String(state.devices.length)} available device(s)
        </text>
      </FoundationBox>
    )
  }

  if (state.status === "nothing-playing") {
    return (
      <FoundationBox compact={compact} focused={fallbackFocused}>
        <text fg={theme.colors.accentSecondary}>
          <strong>NOTHING PLAYING</strong>
        </text>
        <text fg={theme.colors.textSecondary}>
          Device ready: {activeDeviceName(state)}
        </text>
        <text fg={theme.colors.textMuted}>
          Start playback in Spotify, then UmrooFM will follow.
        </text>
      </FoundationBox>
    )
  }

  if (state.status === "error" || playback === null || item === null) {
    return (
      <FoundationBox compact={compact} focused={fallbackFocused}>
        <text fg={theme.colors.error}>
          <strong>SPOTIFY SIGNAL LOST</strong>
        </text>
        <text fg={theme.colors.textSecondary}>
          {state.notice?.message ?? "Playback data is unavailable."}
        </text>
      </FoundationBox>
    )
  }

  return (
    <FoundationBox compact={compact} focused={false}>
      {showSpectrum ? (
        <SpectrumVisualizer
          playback={playback}
          animationsEnabled={animationsEnabled}
          width={resolveSpectrumWidth(mode)}
          height={mode === "large" ? 6 : 2}
        />
      ) : null}
      <TrackMetadata item={item} compact={narrowCompact} />
      <TransportControls
        playback={playback}
        compact={narrowCompact}
        focused={focusTarget === "transport"}
        actions={actions}
      />
      <ProgressBar
        progress={state.progress}
        durationMs={item.durationMs}
        width={resolveProgressWidth(mode, terminalWidth)}
        focused={focusTarget === "progress"}
        onSeek={actions.seekTo}
        liveUpdates={liveProgress}
      />
      <VolumeControl
        device={playback.device}
        compact={narrowCompact}
        focused={focusTarget === "volume"}
        actions={actions}
      />
    </FoundationBox>
  )
}

function FoundationBox({
  compact,
  focused,
  children,
}: {
  compact: boolean
  focused: boolean
  children: React.ReactNode
}) {
  const theme = useAppTheme()
  return (
    <box
      id={focused ? "focus-transport" : "player-foundation"}
      focusable={focused}
      focused={focused}
      backgroundColor={theme.colors.background}
      flexDirection="column"
      flexGrow={1}
      minHeight={compact ? 8 : 13}
      alignItems="center"
      justifyContent="center"
      gap={compact ? 0 : 1}
      paddingX={1}
      paddingY={compact ? 0 : 1}
    >
      {children}
    </box>
  )
}

function resolveProgressWidth(
  mode: Exclude<LayoutMode, "too-small">,
  terminalWidth: number,
): number {
  if (mode === "compact") {
    return Math.max(18, Math.min(38, terminalWidth - 18))
  }
  return mode === "large" ? 38 : 30
}

function resolveSpectrumWidth(
  mode: Exclude<LayoutMode, "too-small">,
): number {
  return mode === "large" ? 48 : 34
}

function activeDeviceName(state: PlaybackViewState): string {
  return (
    state.devices.find((device) => device.isActive)?.name ??
    "unknown device"
  )
}
