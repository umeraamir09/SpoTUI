import type {
  DiscoveryNotice,
  LibraryViewState,
} from "../../discovery/discovery-controller"
import type {
  MediaItem,
  PlaylistSummary,
} from "../../discovery/types"
import {
  resolveLayoutMode,
  type TerminalDimensions,
} from "../layout/layout"
import { useAppTheme } from "../theme/theme-context"
import { AppHeader } from "./AppHeader"
import type { AppPage } from "../navigation/page"
import { clip, MediaRow } from "./MediaRow"
import { PixelButton } from "./PixelButton"
import { TooSmallState } from "./TooSmallState"

export interface LibrarySurfaceProps extends TerminalDimensions {
  state: LibraryViewState
  section: "liked" | "playlists"
  selectedIndex: number
  notice: DiscoveryNotice | null
  addTarget: MediaItem | null
  onSection: (section: "liked" | "playlists") => void
  onSelect: (index: number) => void
  onPlayItem: (item: MediaItem) => void
  onQueueItem: (item: MediaItem) => void
  onLikeItem: (item: MediaItem) => void
  onOpenPlaylist: (playlist: PlaylistSummary) => void
  onPlayPlaylist: (playlist: PlaylistSummary, item?: MediaItem) => void
  onChoosePlaylist: (playlist: PlaylistSummary) => void
  onBack: () => void
  onReconnect: () => void
  onNavigate: (page: AppPage) => void
}

export function LibrarySurface({
  state,
  section,
  selectedIndex,
  notice,
  addTarget,
  onSection,
  onSelect,
  onPlayItem,
  onQueueItem,
  onLikeItem,
  onOpenPlaylist,
  onPlayPlaylist,
  onChoosePlaylist,
  onBack,
  onReconnect,
  onNavigate,
  ...dimensions
}: LibrarySurfaceProps) {
  const theme = useAppTheme()
  const mode = resolveLayoutMode(dimensions)
  if (mode === "too-small") {
    return <TooSmallState {...dimensions} />
  }
  const compact = mode === "compact"
  const lowHeight = dimensions.height < 20
  const maxRows = Math.max(4, dimensions.height - 11)
  const activePlaylist = state.activePlaylist
  const selectedPlaylistItem =
    activePlaylist === null
      ? null
      : (state.playlistItems.items[selectedIndex] ?? null)

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={theme.colors.background}>
      <AppHeader mode={mode} activePage="library" onNavigate={onNavigate} />
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
            <text fg={theme.colors.accent} flexGrow={1}>
              <strong>
                {addTarget === null
                  ? activePlaylist?.name ?? "SPOTIFY LIBRARY"
                  : `ADD “${clip(addTarget.title, 24)}” TO PLAYLIST`}
              </strong>
            </text>
            {activePlaylist === null ? null : (
              <PixelButton id="library-back" label="<" width={3} onPress={onBack} />
            )}
          </box>
          {activePlaylist === null ? (
            <>
              {addTarget === null ? (
                <box height={1} flexDirection="row" gap={2}>
                  <text
                    fg={section === "liked" ? theme.colors.accent : theme.colors.textMuted}
                    onMouseDown={() => { onSection("liked") }}
                  >
                    <strong>[ LIKED SONGS ]</strong>
                  </text>
                  <text
                    fg={section === "playlists" ? theme.colors.accent : theme.colors.textMuted}
                    onMouseDown={() => { onSection("playlists") }}
                  >
                    <strong>[ PLAYLISTS ]</strong>
                  </text>
                </box>
              ) : null}
              {lowHeight && state.status === "error" ? null : (
                <text fg={theme.colors.textMuted}>
                  {addTarget === null
                    ? "←/→ section · ↑/↓ select · Enter open/play · P play · PgUp/PgDn page"
                    : "↑/↓ select · Enter add · Esc cancel"}
                </text>
              )}
              {state.status === "loading" ? (
                <text fg={theme.colors.textSecondary}>LOADING YOUR LIBRARY...</text>
              ) : state.status === "error" ? (
                <>
                  <text fg={theme.colors.error}>
                    {state.error ?? "Library unavailable."}
                  </text>
                  {lowHeight ? (
                    <text
                      fg={theme.colors.accent}
                      onMouseDown={(event) => {
                        if (event.button === 0) {
                          event.stopPropagation()
                          onReconnect()
                        }
                      }}
                    >
                      [Shift+R] REAUTHORIZE SPOTIFY
                    </text>
                  ) : (
                    <>
                      <PixelButton
                        id="library-reauthorize"
                        label="REAUTHORIZE SPOTIFY"
                        width={21}
                        primary
                        onPress={onReconnect}
                      />
                      <text fg={theme.colors.textMuted}>
                        Press Shift+R to grant the required library and playlist permissions.
                      </text>
                    </>
                  )}
                </>
              ) : section === "liked" && addTarget === null ? (
                <TrackList
                  items={state.snapshot.likedTracks.items.slice(0, maxRows)}
                  selectedIndex={selectedIndex}
                  width={dimensions.width - 8}
                  onSelect={onSelect}
                  onActivate={onPlayItem}
                />
              ) : (
                <PlaylistList
                  items={state.snapshot.playlists.items.slice(0, maxRows)}
                  selectedIndex={selectedIndex}
                  width={dimensions.width - 8}
                  onSelect={onSelect}
                  onActivate={
                    addTarget === null ? onOpenPlaylist : onChoosePlaylist
                  }
                />
              )}
            </>
          ) : (
            <>
              <text fg={theme.colors.textMuted}>
                Backspace back · ↑/↓ select · Enter/P play · A queue · F like · PgUp/PgDn page
              </text>
              {state.playlistStatus === "loading" ? (
                <text fg={theme.colors.textSecondary}>LOADING PLAYLIST ITEMS...</text>
              ) : state.playlistStatus === "error" ? (
                <>
                  <text fg={theme.colors.error}>{state.error ?? "Playlist items unavailable."}</text>
                  <PixelButton
                    id="library-play-context"
                    label="PLAY PLAYLIST"
                    width={15}
                    primary
                    onPress={() => { onPlayPlaylist(activePlaylist) }}
                  />
                </>
              ) : (
                <>
                  <TrackList
                    items={state.playlistItems.items.slice(0, maxRows)}
                    selectedIndex={selectedIndex}
                    width={dimensions.width - 8}
                    onSelect={onSelect}
                    onActivate={(item) => { onPlayPlaylist(activePlaylist, item) }}
                  />
                  {selectedPlaylistItem === null ? null : (
                    <box height={3} flexDirection="row" gap={1} alignItems="center">
                      <PixelButton
                        id="library-item-play"
                        label="PLAY"
                        width={6}
                        primary
                        onPress={() => {
                          onPlayPlaylist(activePlaylist, selectedPlaylistItem)
                        }}
                      />
                      <PixelButton
                        id="library-item-queue"
                        label="QUEUE"
                        width={7}
                        onPress={() => { onQueueItem(selectedPlaylistItem) }}
                      />
                      <PixelButton
                        id="library-item-like"
                        label="LIKE"
                        width={6}
                        onPress={() => { onLikeItem(selectedPlaylistItem) }}
                      />
                    </box>
                  )}
                </>
              )}
            </>
          )}
          <text fg={theme.colors.textMuted}>
            {notice?.message ?? "Spotify Web API library · Esc close"}
          </text>
        </box>
      </box>
    </box>
  )
}

function TrackList({
  items,
  selectedIndex,
  width,
  onSelect,
  onActivate,
}: {
  items: readonly MediaItem[]
  selectedIndex: number
  width: number
  onSelect: (index: number) => void
  onActivate: (item: MediaItem) => void
}) {
  const theme = useAppTheme()
  if (items.length === 0) {
    return <text fg={theme.colors.textSecondary}>No tracks on this page.</text>
  }
  return items.map((item, index) => (
    <MediaRow
      key={`${item.uri ?? item.title}:${String(index)}`}
      item={item}
      selected={index === selectedIndex}
      width={width}
      onSelect={() => { onSelect(index) }}
      onActivate={() => { onActivate(item) }}
    />
  ))
}

function PlaylistList({
  items,
  selectedIndex,
  width,
  onSelect,
  onActivate,
}: {
  items: readonly PlaylistSummary[]
  selectedIndex: number
  width: number
  onSelect: (index: number) => void
  onActivate: (playlist: PlaylistSummary) => void
}) {
  const theme = useAppTheme()
  if (items.length === 0) {
    return <text fg={theme.colors.textSecondary}>No playlists on this page.</text>
  }
  return items.map((playlist, index) => {
    const selected = index === selectedIndex
    return (
      <box
        key={playlist.id}
        height={1}
        width="100%"
        paddingX={1}
        flexDirection="row"
        backgroundColor={selected ? theme.colors.surfaceRaised : theme.colors.surface}
        onMouseOver={() => { onSelect(index) }}
        onMouseDown={(event) => {
          if (event.button === 0) {
            event.stopPropagation()
            onSelect(index)
            onActivate(playlist)
          }
        }}
      >
        <text width={2} fg={selected ? theme.colors.accent : theme.colors.textMuted}>
          {selected ? ">" : " "}
        </text>
        <text width={Math.max(16, Math.floor(width * 0.55))} fg={theme.colors.textPrimary}>
          {clip(playlist.name, Math.max(14, Math.floor(width * 0.55) - 1))}
        </text>
        <text width={Math.max(10, Math.floor(width * 0.28))} fg={theme.colors.textSecondary}>
          {clip(playlist.owner, Math.max(8, Math.floor(width * 0.28) - 1))}
        </text>
        <text fg={theme.colors.textMuted}>{String(playlist.totalItems)} items</text>
      </box>
    )
  })
}
