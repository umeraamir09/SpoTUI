import type { MediaItem } from "../../discovery/types"
import { formatDuration } from "../../shared/format"
import { useAppTheme } from "../theme/theme-context"

export function MediaRow({
  item,
  selected,
  width,
  onSelect,
  onActivate,
}: {
  item: MediaItem
  selected: boolean
  width: number
  onSelect?: () => void
  onActivate?: () => void
}) {
  const theme = useAppTheme()
  const compact = width < 76
  const titleWidth = Math.max(10, compact ? width - 17 : Math.floor(width * 0.4))
  const artistWidth = Math.max(
    8,
    compact ? width - titleWidth - 12 : Math.floor(width * 0.28),
  )
  const albumWidth = Math.max(0, width - titleWidth - artistWidth - 16)

  return (
    <box
      height={1}
      width="100%"
      paddingX={1}
      flexDirection="row"
      backgroundColor={
        selected ? theme.colors.surfaceRaised : theme.colors.surface
      }
      {...(onSelect === undefined ? {} : { onMouseOver: onSelect })}
      onMouseDown={(event) => {
        if (event.button !== 0) {
          return
        }
        event.stopPropagation()
        onSelect?.()
        onActivate?.()
      }}
    >
      <text
        width={2}
        fg={selected ? theme.colors.accent : theme.colors.textMuted}
      >
        {selected ? ">" : " "}
      </text>
      <text width={titleWidth} fg={theme.colors.textPrimary}>
        {clip(item.title, titleWidth - 1)}
      </text>
      <text width={artistWidth} fg={theme.colors.textSecondary}>
        {clip(item.artists.join(", "), artistWidth - 1)}
      </text>
      {compact ? null : (
        <text width={albumWidth} fg={theme.colors.textMuted}>
          {clip(item.album ?? "", Math.max(0, albumWidth - 1))}
        </text>
      )}
      <text width={3} fg={item.explicit ? theme.colors.error : theme.colors.textMuted}>
        {item.explicit ? "E" : ""}
      </text>
      <text width={6} fg={theme.colors.textMuted}>
        {formatDuration(item.durationMs)}
      </text>
    </box>
  )
}

export function clip(value: string, width: number): string {
  if (width <= 0) {
    return ""
  }
  if (value.length <= width) {
    return value
  }
  return width === 1 ? value.slice(0, 1) : `${value.slice(0, width - 1)}…`
}
