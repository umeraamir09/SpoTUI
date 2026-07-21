import type { PlaybackSnapshot } from "../../playback/types"
import { useAppTheme } from "../theme/theme-context"
import { PixelButton } from "./PixelButton"
import type { PlayerActions } from "./player-actions"

export function TransportControls({
  playback,
  compact,
  focused,
  actions,
}: {
  playback: PlaybackSnapshot
  compact: boolean
  focused: boolean
  actions: PlayerActions
}) {
  const theme = useAppTheme()
  return (
    <box
      id="focus-transport"
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
      <PixelButton
        id="transport-shuffle"
        label={theme.glyphs.transportShuffle}
        active={playback.shuffleState}
        onPress={actions.toggleShuffle}
      />
      <PixelButton
        id="transport-previous"
        label={theme.glyphs.transportPrevious}
        onPress={actions.previous}
      />
      <PixelButton
        id="transport-toggle"
        label={
          playback.isPlaying
            ? theme.glyphs.transportPause
            : theme.glyphs.transportPlay
        }
        primary
        onPress={actions.togglePlayback}
      />
      <PixelButton
        id="transport-next"
        label={theme.glyphs.transportNext}
        onPress={actions.next}
      />
      <PixelButton
        id="transport-repeat"
        label={theme.glyphs.transportRepeat}
        active={playback.repeatState !== "off"}
        onPress={actions.cycleRepeat}
      />
    </box>
  )
}
