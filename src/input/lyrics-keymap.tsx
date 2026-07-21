import type { Binding } from "@opentui/keymap"
import { useBindings } from "@opentui/keymap/react"

import { COMMANDS } from "./commands"

export const LYRICS_BINDINGS = [
  { key: "y", cmd: COMMANDS.panelLyrics },
  { key: "i", cmd: COMMANDS.panelInfo },
] as const satisfies readonly Binding[]

export const LYRICS_SCROLL_BINDINGS = [
  { key: "up", cmd: COMMANDS.lyricsPrevious },
  { key: "k", cmd: COMMANDS.lyricsPrevious },
  { key: "down", cmd: COMMANDS.lyricsNext },
  { key: "j", cmd: COMMANDS.lyricsNext },
] as const satisfies readonly Binding[]

export function LyricsCommandLayer({
  enabled,
  lyricsOpen,
  onToggle,
  onInfo,
  onScroll,
}: {
  enabled: boolean
  lyricsOpen: boolean
  onToggle: () => void
  onInfo: () => void
  onScroll: (direction: -1 | 1) => void
}): null {
  useBindings(
    () => ({
      priority: 7,
      commands: [
        { name: COMMANDS.panelLyrics, title: "Toggle lyrics", desc: "Show or hide the lyrics panel", run: onToggle },
        { name: COMMANDS.panelInfo, title: "Show track info", desc: "Show track metadata", run: onInfo },
        { name: COMMANDS.lyricsPrevious, title: "Previous lyric line", desc: "Scroll lyrics up", run: () => onScroll(-1) },
        { name: COMMANDS.lyricsNext, title: "Next lyric line", desc: "Scroll lyrics down", run: () => onScroll(1) },
      ],
      bindings: !enabled ? [] : lyricsOpen ? [...LYRICS_BINDINGS, ...LYRICS_SCROLL_BINDINGS] : LYRICS_BINDINGS,
    }),
    [enabled, lyricsOpen, onInfo, onScroll, onToggle],
  )
  return null
}
