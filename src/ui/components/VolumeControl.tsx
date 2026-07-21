import type { PlaybackDevice } from "../../playback/types"
import { useAppTheme } from "../theme/theme-context"
import { PixelButton } from "./PixelButton"
import type { PlayerActions } from "./player-actions"

export function VolumeControl({
  device,
  compact,
  focused,
  actions,
}: {
  device: PlaybackDevice
  compact: boolean
  focused: boolean
  actions: PlayerActions
}) {
  const theme = useAppTheme()
  const volumeUnavailable =
    device.volumePercent === null ||
    !device.supportsVolume ||
    device.isRestricted
  return (
    <box
      id="focus-volume"
      focusable
      focused={focused}
      height={3}
      width="100%"
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      gap={compact ? 0 : 1}
      backgroundColor={theme.colors.background}
    >
      <text fg={theme.colors.textMuted}>
        {compact ? "VOL" : "VOLUME"}{" "}
        {device.volumePercent === null
          ? "N/A"
          : `${String(device.volumePercent)}%`}
      </text>
      <PixelButton
        id="volume-down"
        label="-"
        width={3}
        disabled={volumeUnavailable}
        onPress={actions.volumeDown}
      />
      <PixelButton
        id="volume-mute"
        label={device.volumePercent === 0 ? "X" : "M"}
        width={3}
        disabled={volumeUnavailable}
        onPress={actions.toggleMute}
      />
      <PixelButton
        id="volume-up"
        label="+"
        width={3}
        disabled={volumeUnavailable}
        onPress={actions.volumeUp}
      />
      <PixelButton
        id="device-open"
        label={compact ? "D" : "DEV"}
        width={compact ? 3 : 5}
        onPress={actions.openDevices}
      />
    </box>
  )
}
