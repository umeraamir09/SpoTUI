import type { PlaybackViewState } from "../../playback/playback-controller"
import type { LayoutMode } from "../layout/layout"
import type { UiFocusTarget } from "../state/ui-controller"
import { useAppTheme } from "../theme/theme-context"

export interface StatusBarProps {
  mode: Exclude<LayoutMode, "too-small">
  state: PlaybackViewState
  focusTarget: UiFocusTarget
}

export function StatusBar({
  mode,
  state,
  focusTarget,
}: StatusBarProps) {
  const theme = useAppTheme()
  const activeDevice =
    state.playback?.device ??
    state.devices.find((device) => device.isActive) ??
    null
  const detail =
    mode === "compact"
      ? "/ FIND  U QUEUE  B LIB"
      : mode === "medium"
        ? `/ search ${theme.glyphs.separator} u queue ${theme.glyphs.separator} b library ${theme.glyphs.separator} d device`
        : `device: ${activeDevice?.name ?? "none"} ${theme.glyphs.separator} / search ${theme.glyphs.separator} u queue ${theme.glyphs.separator} b library ${theme.glyphs.separator} d devices ${theme.glyphs.separator} q quit`
  const status =
    state.stale
      ? "STALE"
      : state.playback?.isPlaying === true
        ? "PLAYING"
        : state.status === "no-device"
          ? "NO DEVICE"
          : "PAUSED"

  return (
    <box
      border={theme.presentation.borders ? ["top"] : false}
      {...(theme.presentation.borders
        ? { borderColor: theme.colors.border }
        : {})}
      height={3}
      paddingX={1}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      backgroundColor={theme.colors.background}
    >
      <text fg={theme.colors.textSecondary}>{detail}</text>
      <text fg={theme.colors.accentSecondary}>
        {theme.glyphs.statusReady} FOCUS {focusTarget.toUpperCase()} / {status}
      </text>
    </box>
  )
}
