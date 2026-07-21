import type {
  DiscoveryNotice,
  QueueViewState,
} from "../../discovery/discovery-controller"
import type { MediaItem } from "../../discovery/types"
import {
  resolveLayoutMode,
  type TerminalDimensions,
} from "../layout/layout"
import { useAppTheme } from "../theme/theme-context"
import { AppHeader } from "./AppHeader"
import type { AppPage } from "../navigation/page"
import { MediaRow } from "./MediaRow"
import { PixelButton } from "./PixelButton"
import { TooSmallState } from "./TooSmallState"

export interface QueueSurfaceProps extends TerminalDimensions {
  state: QueueViewState
  selectedIndex: number
  notice: DiscoveryNotice | null
  onSelect: (index: number) => void
  onPlay: (item: MediaItem) => void
  onRefresh: () => void
  onNavigate: (page: AppPage) => void
}

export function QueueSurface({
  state,
  selectedIndex,
  notice,
  onSelect,
  onPlay,
  onRefresh,
  onNavigate,
  ...dimensions
}: QueueSurfaceProps) {
  const theme = useAppTheme()
  const mode = resolveLayoutMode(dimensions)
  if (mode === "too-small") {
    return <TooSmallState {...dimensions} />
  }
  const compact = mode === "compact"
  const maxRows = Math.max(4, dimensions.height - 11)
  const visibleItems = state.snapshot.items.slice(0, maxRows)

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={theme.colors.background}>
      <AppHeader mode={mode} activePage="queue" onNavigate={onNavigate} />
      <box flexGrow={1} alignItems="stretch" padding={compact ? 0 : 1}>
        <box
          width="100%"
          border={theme.presentation.borders}
          {...(theme.presentation.borders ? { borderColor: theme.colors.border } : {})}
          backgroundColor={theme.colors.surface}
          flexDirection="column"
          padding={1}
        >
          <box height={3} flexDirection="row" alignItems="center">
            <text fg={theme.colors.accent} flexGrow={1}><strong>PLAYBACK QUEUE</strong></text>
            <PixelButton id="queue-refresh" label="↻" width={3} onPress={onRefresh} />
          </box>
          <text fg={theme.colors.textMuted}>↑/↓ select · Enter play now · Esc close</text>
          {state.snapshot.currentlyPlaying === null ? null : (
            <>
              <text fg={theme.colors.accentSecondary}><strong>NOW PLAYING</strong></text>
              <MediaRow item={state.snapshot.currentlyPlaying} selected={false} width={dimensions.width - 8} />
            </>
          )}
          <text fg={theme.colors.accentSecondary}><strong>UP NEXT</strong></text>
          {state.status === "loading" ? (
            <text fg={theme.colors.textSecondary}>REFRESHING QUEUE...</text>
          ) : state.status === "error" ? (
            <text fg={theme.colors.error}>{state.error ?? "Queue unavailable."}</text>
          ) : visibleItems.length === 0 ? (
            <text fg={theme.colors.textSecondary}>The Spotify queue is empty.</text>
          ) : (
            visibleItems.map((item, index) => (
              <MediaRow
                key={`${item.uri ?? item.title}:${String(index)}`}
                item={item}
                selected={index === selectedIndex}
                width={dimensions.width - 8}
                onSelect={() => { onSelect(index) }}
                onActivate={() => { onPlay(item) }}
              />
            ))
          )}
          <text fg={theme.colors.textMuted}>
            {notice?.message ??
              `Showing ${String(visibleItems.length)} queued item(s)`}
          </text>
        </box>
      </box>
    </box>
  )
}
