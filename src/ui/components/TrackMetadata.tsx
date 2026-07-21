import type { PlaybackItem } from "../../playback/types"
import { useAppTheme } from "../theme/theme-context"

export function TrackMetadata({
  item,
  compact,
}: {
  item: PlaybackItem
  compact: boolean
}) {
  const theme = useAppTheme()
  return (
    <>
      <text fg={theme.colors.textPrimary}>
        <strong>{item.title}</strong>
      </text>
      {compact ? null : (
        <text fg={theme.colors.textSecondary}>
          {item.artists.join(", ")}
          {item.album === null
            ? ""
            : ` ${theme.glyphs.separator} ${item.album}`}
          {item.kind === "episode" ? " / EPISODE" : ""}
          {item.isLocal ? " / LOCAL" : ""}
        </text>
      )}
    </>
  )
}
