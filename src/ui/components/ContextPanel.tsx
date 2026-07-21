import type { PlaybackViewState } from "../../playback/playback-controller"
import type { PlaybackDevice } from "../../playback/types"
import type { QueueViewState } from "../../discovery/discovery-controller"
import type { LyricsViewState } from "../../lyrics/types"
import type { ProgressAnchor } from "../../playback/progress-clock"
import type { UiToast } from "../state/ui-controller"
import { useAppTheme } from "../theme/theme-context"
import { ToastList } from "./ToastHost"
import { LyricsPanel } from "./LyricsPanel"

export type ContextPanelTab = "queue" | "lyrics" | "info" | "device"

export function ContextPanel({
  state,
  focused,
  toasts,
  tab,
  lyrics,
  queue,
  progress,
  lyricsManualOffset,
  liveLyrics,
  compact,
}: {
  state: PlaybackViewState
  focused: boolean
  toasts: readonly UiToast[]
  tab: ContextPanelTab
  lyrics: LyricsViewState
  queue: QueueViewState
  progress: ProgressAnchor | null
  lyricsManualOffset: number | null
  liveLyrics: boolean
  compact: boolean
}) {
  const theme = useAppTheme()
  const active =
    state.playback?.device ??
    state.devices.find((device) => device.isActive) ??
    null

  return (
    <box
      id="focus-devices"
      focusable
      focused={focused}
      backgroundColor={theme.colors.background}
      flexDirection="column"
      height={toasts.length > 0 ? 4 : tab === "lyrics" ? 7 : 2}
      paddingX={1}
    >
      {toasts.length > 0 ? (
        <ToastList toasts={toasts} />
      ) : (
        <>
          {!compact ? <text fg={theme.colors.textMuted}>[QUEUE] [LYRICS] [INFO] [DEVICE]  / {tab.toUpperCase()}</text> : null}
          {tab === "lyrics" ? <LyricsPanel lyrics={lyrics} progress={progress} liveUpdates={liveLyrics} manualOffset={lyricsManualOffset} /> : null}
          {tab === "queue" ? <QueuePanel queue={queue} /> : null}
          {tab === "info" ? <InfoPanel state={state} /> : null}
          {tab === "device" ? <DevicePanel active={active} count={state.devices.length} focused={focused} /> : null}
        </>
      )}
    </box>
  )
}

function QueuePanel({ queue }: { queue: QueueViewState }) {
  const theme = useAppTheme()
  if (queue.status === "loading") return <text fg={theme.colors.textMuted}>Loading queue...</text>
  if (queue.status === "error") return <text fg={theme.colors.textMuted}>Queue unavailable. Press u to retry.</text>
  const next = queue.snapshot.items[0]
  return next === undefined
    ? <text fg={theme.colors.textMuted}>Queue is empty. Press u to view or refresh it.</text>
    : <text fg={theme.colors.textSecondary}>Next: {next.title} - {next.artists.join(", ")} / press u for queue</text>
}

function InfoPanel({ state }: { state: PlaybackViewState }) {
  const theme = useAppTheme()
  const item = state.playback?.item
  return item === null || item === undefined ? <text fg={theme.colors.textMuted}>No track information available.</text> : <><text fg={theme.colors.textSecondary}>{item.title}</text><text fg={theme.colors.textMuted}>{item.artists.join(", ")} {item.album === null ? "" : `/ ${item.album}`}</text><text fg={theme.colors.textMuted}>{Math.round(item.durationMs / 1_000)}s {item.isLocal ? "/ local" : ""} {item.uri ?? ""}</text></>
}

function DevicePanel({ active, count, focused }: { active: PlaybackDevice | null; count: number; focused: boolean }) {
  const theme = useAppTheme()
  return <><text fg={theme.colors.textSecondary}><span fg={focused ? theme.colors.accent : theme.colors.accentSecondary}>{focused ? theme.glyphs.statusReady : theme.glyphs.statusIdle}</span> {active === null ? "No active device" : `${active.name} / ${active.type}`}</text><text fg={theme.colors.textMuted}>{active === null ? `${String(count)} available / press d to choose` : active.isRestricted ? "restricted / Web API controls disabled" : active.supportsVolume ? `volume ${String(active.volumePercent ?? 0)}% / press d to choose` : "device volume is not exposed"}</text></>
}
