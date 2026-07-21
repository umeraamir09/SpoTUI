import type { Binding } from "@opentui/keymap"
import { useBindings } from "@opentui/keymap/react"

import { COMMANDS } from "./commands"

export const DISCOVERY_OPEN_BINDINGS = [
  { key: "/", cmd: COMMANDS.searchOpen },
  { key: "g", cmd: COMMANDS.browseOpen },
  { key: "u", cmd: COMMANDS.queueOpen },
  { key: "b", cmd: COMMANDS.libraryOpen },
] as const satisfies readonly Binding[]

export function DiscoveryOpenCommandLayer({
  enabled,
  onSearch,
  onBrowse,
  onQueue,
  onLibrary,
}: {
  enabled: boolean
  onSearch: () => void
  onBrowse: () => void
  onQueue: () => void
  onLibrary: () => void
}): null {
  useBindings(
    () => ({
      priority: 7,
      commands: [
        command(COMMANDS.searchOpen, "Search Spotify", onSearch),
        command(COMMANDS.browseOpen, "Open browse", onBrowse),
        command(COMMANDS.queueOpen, "Open queue", onQueue),
        command(COMMANDS.libraryOpen, "Open library", onLibrary),
      ],
      bindings: enabled ? DISCOVERY_OPEN_BINDINGS : [],
    }),
    [enabled, onBrowse, onLibrary, onQueue, onSearch],
  )
  return null
}

export const SEARCH_NAVIGATION_BINDINGS = [
  { key: "up", cmd: COMMANDS.searchPrevious },
  { key: "down", cmd: COMMANDS.searchNext },
  { key: "pageup", cmd: COMMANDS.pagePrevious },
  { key: "pagedown", cmd: COMMANDS.pageNext },
] as const satisfies readonly Binding[]

export const SEARCH_RESULT_BINDINGS = [
  { key: "k", cmd: COMMANDS.searchPrevious },
  { key: "j", cmd: COMMANDS.searchNext },
  { key: "return", cmd: COMMANDS.searchPlay },
  { key: "a", cmd: COMMANDS.searchQueue },
  { key: "f", cmd: COMMANDS.searchLike },
  { key: "v", cmd: COMMANDS.searchPlaylist },
  { key: "o", cmd: COMMANDS.searchOpenSpotify },
  { key: "/", cmd: COMMANDS.searchInput },
] as const satisfies readonly Binding[]

export function SearchCommandLayer({
  enabled,
  listFocused,
  onInput,
  onPrevious,
  onNext,
  onPlay,
  onQueue,
  onLike,
  onPlaylist,
  onOpenSpotify,
  onPage,
}: {
  enabled: boolean
  listFocused: boolean
  onInput: () => void
  onPrevious: () => void
  onNext: () => void
  onPlay: () => void
  onQueue: () => void
  onLike: () => void
  onPlaylist: () => void
  onOpenSpotify: () => void
  onPage: (direction: -1 | 1) => void
}): null {
  useBindings(
    () => ({
      priority: 30,
      commands: [
        command(COMMANDS.searchInput, "Focus search input", onInput),
        command(COMMANDS.searchPrevious, "Previous result", onPrevious),
        command(COMMANDS.searchNext, "Next result", onNext),
        command(COMMANDS.searchPlay, "Play result", onPlay),
        command(COMMANDS.searchQueue, "Queue result", onQueue),
        command(COMMANDS.searchLike, "Save result", onLike),
        command(
          COMMANDS.searchPlaylist,
          "Add result to playlist",
          onPlaylist,
        ),
        command(
          COMMANDS.searchOpenSpotify,
          "Open result in Spotify",
          onOpenSpotify,
        ),
        command(COMMANDS.pagePrevious, "Previous page", () => {
          onPage(-1)
        }),
        command(COMMANDS.pageNext, "Next page", () => {
          onPage(1)
        }),
      ],
      bindings: enabled
        ? [
            ...SEARCH_NAVIGATION_BINDINGS,
            ...(listFocused ? SEARCH_RESULT_BINDINGS : []),
          ]
        : [],
    }),
    [
      enabled,
      listFocused,
      onInput,
      onLike,
      onNext,
      onOpenSpotify,
      onPage,
      onPlay,
      onPlaylist,
      onPrevious,
      onQueue,
    ],
  )
  return null
}

export const QUEUE_BINDINGS = [
  { key: "up", cmd: COMMANDS.queuePrevious },
  { key: "k", cmd: COMMANDS.queuePrevious },
  { key: "down", cmd: COMMANDS.queueNext },
  { key: "j", cmd: COMMANDS.queueNext },
  { key: "return", cmd: COMMANDS.queuePlay },
] as const satisfies readonly Binding[]

export function QueueCommandLayer({
  enabled,
  onPrevious,
  onNext,
  onPlay,
}: {
  enabled: boolean
  onPrevious: () => void
  onNext: () => void
  onPlay: () => void
}): null {
  useBindings(
    () => ({
      priority: 30,
      commands: [
        command(COMMANDS.queuePrevious, "Previous queued item", onPrevious),
        command(COMMANDS.queueNext, "Next queued item", onNext),
        command(COMMANDS.queuePlay, "Play queued item", onPlay),
      ],
      bindings: enabled ? QUEUE_BINDINGS : [],
    }),
    [enabled, onNext, onPlay, onPrevious],
  )
  return null
}

export const LIBRARY_BINDINGS = [
  { key: "up", cmd: COMMANDS.libraryPrevious },
  { key: "k", cmd: COMMANDS.libraryPrevious },
  { key: "down", cmd: COMMANDS.libraryNext },
  { key: "j", cmd: COMMANDS.libraryNext },
  { key: "left", cmd: COMMANDS.libraryPreviousSection },
  { key: "h", cmd: COMMANDS.libraryPreviousSection },
  { key: "right", cmd: COMMANDS.libraryNextSection },
  { key: "l", cmd: COMMANDS.libraryNextSection },
  { key: "return", cmd: COMMANDS.librarySelect },
  { key: "p", cmd: COMMANDS.libraryPlay },
  { key: "a", cmd: COMMANDS.libraryQueue },
  { key: "f", cmd: COMMANDS.libraryLike },
  { key: "backspace", cmd: COMMANDS.libraryBack },
  { key: "shift+r", cmd: COMMANDS.libraryReconnect },
  { key: "pageup", cmd: COMMANDS.pagePrevious },
  { key: "pagedown", cmd: COMMANDS.pageNext },
] as const satisfies readonly Binding[]

export function LibraryCommandLayer({
  enabled,
  onPrevious,
  onNext,
  onSection,
  onSelect,
  onPlay,
  onQueue,
  onLike,
  onBack,
  onReconnect,
  onPage,
}: {
  enabled: boolean
  onPrevious: () => void
  onNext: () => void
  onSection: (direction: -1 | 1) => void
  onSelect: () => void
  onPlay: () => void
  onQueue: () => void
  onLike: () => void
  onBack: () => void
  onReconnect: () => void
  onPage: (direction: -1 | 1) => void
}): null {
  useBindings(
    () => ({
      priority: 30,
      commands: [
        command(COMMANDS.libraryPrevious, "Previous library item", onPrevious),
        command(COMMANDS.libraryNext, "Next library item", onNext),
        command(COMMANDS.libraryPreviousSection, "Previous section", () => {
          onSection(-1)
        }),
        command(COMMANDS.libraryNextSection, "Next section", () => {
          onSection(1)
        }),
        command(COMMANDS.librarySelect, "Open or play item", onSelect),
        command(COMMANDS.libraryPlay, "Play library item", onPlay),
        command(COMMANDS.libraryQueue, "Queue library item", onQueue),
        command(COMMANDS.libraryLike, "Save library item", onLike),
        command(COMMANDS.libraryBack, "Back to playlists", onBack),
        command(
          COMMANDS.libraryReconnect,
          "Reauthorize Spotify permissions",
          onReconnect,
        ),
        command(COMMANDS.pagePrevious, "Previous page", () => {
          onPage(-1)
        }),
        command(COMMANDS.pageNext, "Next page", () => {
          onPage(1)
        }),
      ],
      bindings: enabled ? LIBRARY_BINDINGS : [],
    }),
    [
      enabled,
      onBack,
      onLike,
      onNext,
      onPage,
      onPlay,
      onPrevious,
      onQueue,
      onReconnect,
      onSection,
      onSelect,
    ],
  )
  return null
}

function command(name: string, title: string, run: () => void) {
  return {
    name,
    title,
    desc: title,
    run,
  }
}
