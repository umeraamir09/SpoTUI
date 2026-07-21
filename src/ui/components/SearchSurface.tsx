import type {
  DiscoveryNotice,
  DiscoveryViewState,
} from "../../discovery/discovery-controller"
import type { MediaItem } from "../../discovery/types"
import {
  resolveLayoutMode,
  type TerminalDimensions,
} from "../layout/layout"
import type { AppPage } from "../navigation/page"
import { useAppTheme } from "../theme/theme-context"
import { AppHeader } from "./AppHeader"
import { MediaRow } from "./MediaRow"
import { PixelButton } from "./PixelButton"
import { TooSmallState } from "./TooSmallState"

export interface SearchSurfaceProps extends TerminalDimensions {
  state: DiscoveryViewState["search"]
  inputFocused: boolean
  selectedIndex: number
  notice: DiscoveryNotice | null
  onQuery: (query: string) => void
  onRetry: () => void
  onSelect: (index: number) => void
  onQueue: (item: MediaItem) => void
  onLike: (item: MediaItem) => void
  onPlaylist: (item: MediaItem) => void
  onOpenSpotify: (item: MediaItem) => void
  onNavigate: (page: AppPage) => void
}

export function SearchSurface({
  state,
  inputFocused,
  selectedIndex,
  notice,
  onQuery,
  onRetry,
  onSelect,
  onQueue,
  onLike,
  onPlaylist,
  onOpenSpotify,
  onNavigate,
  ...dimensions
}: SearchSurfaceProps) {
  const theme = useAppTheme()
  const mode = resolveLayoutMode(dimensions)
  if (mode === "too-small") {
    return <TooSmallState {...dimensions} />
  }

  const compact = mode === "compact"
  const lowHeight = dimensions.height < 20
  const selected = state.page.items[selectedIndex] ?? null
  const maxRows = lowHeight
    ? 1
    : Math.max(3, Math.min(10, dimensions.height - 12))
  const visibleItems = state.page.items.slice(0, maxRows)

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={theme.colors.background}>
      <AppHeader mode={mode} activePage="search" onNavigate={onNavigate} />
      <box flexGrow={1} alignItems="stretch" padding={compact ? 0 : 1}>
        <box
          width="100%"
          border={theme.presentation.borders}
          {...(theme.presentation.borders ? { borderColor: theme.colors.border } : {})}
          backgroundColor={theme.colors.surface}
          flexDirection="column"
          padding={1}
        >
          <box height={lowHeight ? 1 : 3} flexDirection="row" alignItems="center">
            <text fg={theme.colors.accent} flexGrow={1}><strong>SEARCH SPOTIFY TRACKS</strong></text>
            <text fg={theme.colors.textMuted}>TRACK SEARCH</text>
          </box>
          <box
            height={3}
            border={theme.presentation.borders}
            {...(theme.presentation.borders
              ? { borderColor: inputFocused ? theme.colors.accent : theme.colors.border }
              : {})}
            paddingX={1}
          >
            <input
              value={state.query}
              focused={inputFocused}
              maxLength={200}
              placeholder="Track, artist, or album"
              placeholderColor={theme.colors.textMuted}
              backgroundColor={theme.colors.surfaceRaised}
              focusedBackgroundColor={theme.colors.surfaceRaised}
              textColor={theme.colors.textPrimary}
              focusedTextColor={theme.colors.textPrimary}
              onInput={onQuery}
            />
          </box>
          <text fg={theme.colors.textMuted}>
            {inputFocused
              ? "Type to search; Down opens results; Esc closes"
              : "Up/Down select; Enter/A queue; F like; V playlist; / edit"}
          </text>
          {lowHeight ? null : <SearchStateLine state={state} />}
          {state.status === "error" ? (
            <PixelButton id="search-retry" label="RETRY" width={7} onPress={onRetry} />
          ) : null}
          {visibleItems.map((item, index) => (
            <MediaRow
              key={item.uri ?? `${item.title}:${String(index)}`}
              item={item}
              selected={index === selectedIndex && !inputFocused}
              width={compact ? dimensions.width - 4 : Math.min(88, dimensions.width - 8)}
              onSelect={() => {
                onSelect(index)
              }}
              onActivate={() => {
                onQueue(item)
              }}
            />
          ))}
          {selected === null || lowHeight ? null : (
            <box height={3} flexDirection="row" gap={1} alignItems="center">
              <PixelButton id="search-queue" label="QUEUE" width={7} primary onPress={() => { onQueue(selected) }} />
              <PixelButton id="search-like" label="LIKE" width={6} onPress={() => { onLike(selected) }} />
              <PixelButton id="search-playlist" label="PLAYLIST" width={10} onPress={() => { onPlaylist(selected) }} />
              {compact ? null : (
                <PixelButton id="search-spotify" label="SPOTIFY" width={9} onPress={() => { onOpenSpotify(selected) }} />
              )}
            </box>
          )}
          <text fg={theme.colors.textMuted}>
            {notice === null
              ? `Page ${String(Math.floor(state.page.offset / Math.max(1, state.page.limit || 10)) + 1)}; ${String(state.page.total)} result(s)${state.page.hasPrevious ? "; PgUp" : ""}${state.page.hasNext ? "; PgDn" : ""}`
              : notice.message}
          </text>
        </box>
      </box>
    </box>
  )
}

function SearchStateLine({ state }: { state: DiscoveryViewState["search"] }) {
  const theme = useAppTheme()
  const message =
    state.status === "idle"
      ? state.recentQueries.length === 0
        ? "Start typing to tune the catalog."
        : `Recent: ${state.recentQueries.join(" / ")}`
      : state.status === "loading"
        ? "SEARCHING..."
        : state.status === "empty"
          ? "No matching tracks."
          : state.status === "error"
            ? (state.error ?? "Search failed.")
            : `${String(state.page.items.length)} track(s) on this page`
  return (
    <text fg={state.status === "error" ? theme.colors.error : theme.colors.textSecondary}>
      {message}
    </text>
  )
}
