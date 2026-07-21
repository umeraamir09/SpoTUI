import type { PlaybackViewState } from "../../playback/playback-controller"
import {
  resolveLayoutMode,
  type TerminalDimensions,
} from "../layout/layout"
import { useAppTheme } from "../theme/theme-context"
import { AppHeader } from "./AppHeader"
import type { AppPage } from "../navigation/page"
import { PixelButton } from "./PixelButton"
import { TooSmallState } from "./TooSmallState"

export interface DeviceSurfaceProps extends TerminalDimensions {
  state: PlaybackViewState
  selectedIndex: number
  onNavigate: (page: AppPage) => void
  onRefresh: () => void
  onSelect: (index: number) => void
  onTransfer: (index: number, play: boolean) => void
}

export function DeviceSurface({
  state,
  selectedIndex,
  onNavigate,
  onRefresh,
  onSelect,
  onTransfer,
  ...dimensions
}: DeviceSurfaceProps) {
  const theme = useAppTheme()
  const mode = resolveLayoutMode(dimensions)
  if (mode === "too-small") {
    return <TooSmallState {...dimensions} />
  }

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.colors.background}
    >
      <AppHeader mode={mode} activePage="devices" onNavigate={onNavigate} />
      <box
        flexGrow={1}
        alignItems="stretch"
        padding={1}
      >
        <box
          width="100%"
          border={theme.presentation.borders}
          {...(theme.presentation.borders
            ? { borderColor: theme.colors.border }
            : {})}
          backgroundColor={theme.colors.surface}
          flexDirection="column"
          padding={1}
        >
          <box
            height={3}
            width="100%"
            flexDirection="row"
            alignItems="center"
          >
            <text fg={theme.colors.accent} flexGrow={1}>
              <strong>PLAYBACK DEVICES</strong>
            </text>
            <PixelButton id="device-refresh" label="REFRESH" width={9} onPress={onRefresh} />
          </box>
          <text fg={theme.colors.textMuted}>
            Up/Down select · Enter transfer · Shift+Enter transfer and play ·
            Esc close
          </text>
          <text fg={theme.colors.textSecondary}>CHOOSE SPOTIFY DEVICE</text>
          {state.status === "loading" ? (
            <text fg={theme.colors.textSecondary}>CHECKING AVAILABLE DEVICES...</text>
          ) : state.status === "error" ? (
            <text fg={theme.colors.error}>
              {state.notice?.message ?? "Spotify devices could not be refreshed."}
            </text>
          ) : state.devices.length === 0 ? (
            <text fg={theme.colors.error}>
              No devices reported. Open Spotify on another device.
            </text>
          ) : (
            state.devices.map((device, index) => {
              const selected = index === selectedIndex
              return (
                <box
                  key={device.id ?? device.name}
                  id={`device-option-${String(index)}`}
                  height={3}
                  border={
                    selected && theme.presentation.borders
                      ? ["left"]
                      : false
                  }
                  {...(selected && theme.presentation.borders
                    ? { borderColor: theme.colors.accent }
                    : {})}
                  paddingX={1}
                  flexDirection="column"
                  backgroundColor={
                    selected
                      ? theme.colors.surfaceRaised
                      : theme.colors.surface
                  }
                  onMouseOver={() => {
                    onSelect(index)
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) {
                      return
                    }
                    event.stopPropagation()
                    onSelect(index)
                    onTransfer(index, event.modifiers.shift)
                  }}
                >
                  <text
                    fg={
                      device.isRestricted
                        ? theme.colors.error
                        : selected
                          ? theme.colors.textPrimary
                          : theme.colors.textSecondary
                    }
                  >
                    {selected ? "> " : "  "}
                    {device.name} / {device.type}
                    {device.isActive ? " / ACTIVE" : ""}
                  </text>
                  <text fg={theme.colors.textMuted}>
                    {device.isRestricted
                      ? "Restricted: this device rejects Web API controls"
                      : device.supportsVolume
                        ? `Volume ${String(device.volumePercent ?? 0)}%`
                        : "Volume control unavailable"}
                  </text>
                </box>
              )
            })
          )}
          {state.pendingCommand === null ? null : (
            <text fg={theme.colors.textSecondary}>SWITCHING PLAYBACK DEVICE...</text>
          )}
          {state.notice === null ? null : (
            <text fg={theme.colors.error}>{state.notice.message}</text>
          )}
        </box>
      </box>
    </box>
  )
}
