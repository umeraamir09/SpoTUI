import type { ArtworkControllerPort } from "../../artwork/artwork-service"
import type { PlaybackViewState } from "../../playback/playback-controller"
import type {
  UiFocusTarget,
  UiToast,
} from "../state/ui-controller"
import { AppHeader } from "./AppHeader"
import { ContextPanel } from "./ContextPanel"
import { PlayerFoundation } from "./PlayerFoundation"
import { StatusBar } from "./StatusBar"
import { TooSmallState } from "./TooSmallState"
import { ConnectedVinylDeck } from "./VinylDeck"
import {
  resolveLayoutMode,
  type TerminalDimensions,
} from "../layout/layout"
import { useAppTheme } from "../theme/theme-context"
import type { PlayerActions } from "./player-actions"
import type { AppPage } from "../navigation/page"
import type { LyricsViewState } from "../../lyrics/types"
import type { QueueViewState } from "../../discovery/discovery-controller"
import type { ContextPanelTab } from "./ContextPanel"

export interface PlayerShellProps extends TerminalDimensions {
  state: PlaybackViewState
  artworkController: ArtworkControllerPort
  artworkEnabled: boolean
  animationsEnabled: boolean
  terminalFocused: boolean
  focusTarget: UiFocusTarget
  toasts: readonly UiToast[]
  actions: PlayerActions
  activePage: AppPage
  onNavigate: (page: AppPage) => void
  onOpenSettings: () => void
  onOpenKeybinds: () => void
  contextTab: ContextPanelTab
  lyrics: LyricsViewState
  queue: QueueViewState
  lyricsManualOffset: number | null
}

export function PlayerShell({
  state,
  artworkController,
  artworkEnabled,
  animationsEnabled,
  terminalFocused,
  focusTarget,
  toasts,
  actions,
  activePage,
  onNavigate,
  onOpenSettings,
  onOpenKeybinds,
  contextTab,
  lyrics,
  queue,
  lyricsManualOffset,
  ...dimensions
}: PlayerShellProps) {
  const theme = useAppTheme()
  const mode = resolveLayoutMode(dimensions)

  if (mode === "too-small") {
    return <TooSmallState {...dimensions} />
  }

  if (mode === "compact") {
    return (
      <box
        width="100%"
        height="100%"
        flexDirection="column"
        backgroundColor={theme.colors.background}
      >
        <AppHeader mode={mode} activePage={activePage} onNavigate={onNavigate} onOpenSettings={onOpenSettings} onOpenKeybinds={onOpenKeybinds} animated={animationsEnabled && terminalFocused && state.playback?.isPlaying === true} />
        <box flexGrow={1} flexDirection="column" paddingX={1}>
          <ConnectedVinylDeck
            controller={artworkController}
            enabled={artworkEnabled}
            mode={mode}
            terminalHeight={dimensions.height}
          />
          <PlayerFoundation
            mode={mode}
            state={state}
            terminalWidth={dimensions.width}
            focusTarget={focusTarget}
            actions={actions}
            animationsEnabled={animationsEnabled && terminalFocused}
            liveProgress={terminalFocused}
            showSpectrum={false}
          />
          <ContextPanel
            state={state}
            focused={focusTarget === "devices"}
            toasts={toasts}
            tab={contextTab}
            lyrics={lyrics}
            queue={queue}
            progress={state.progress}
            lyricsManualOffset={lyricsManualOffset}
            liveLyrics={terminalFocused}
            compact
          />
        </box>
        <StatusBar
          mode={mode}
          state={state}
          focusTarget={focusTarget}
        />
      </box>
    )
  }

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.colors.background}
    >
      <AppHeader mode={mode} activePage={activePage} onNavigate={onNavigate} onOpenSettings={onOpenSettings} onOpenKeybinds={onOpenKeybinds} animated={animationsEnabled && terminalFocused && state.playback?.isPlaying === true} />
      <box
        flexGrow={1}
        flexDirection="row"
        gap={1}
        paddingX={1}
        paddingY={1}
      >
        <ConnectedVinylDeck
          controller={artworkController}
          enabled={artworkEnabled}
          mode={mode}
          terminalHeight={dimensions.height}
        />
        <box flexGrow={1} flexDirection="column" gap={1}>
          <ContextPanel
            state={state}
            focused={focusTarget === "devices"}
            toasts={toasts}
            tab={contextTab}
            lyrics={lyrics}
            queue={queue}
            progress={state.progress}
            lyricsManualOffset={lyricsManualOffset}
            liveLyrics={terminalFocused}
            compact={false}
          />
          <PlayerFoundation
            mode={mode}
            state={state}
            terminalWidth={dimensions.width}
            focusTarget={focusTarget}
            actions={actions}
            animationsEnabled={animationsEnabled && terminalFocused}
            liveProgress={terminalFocused}
            showSpectrum={mode === "large" || toasts.length === 0}
          />
        </box>
      </box>
      <StatusBar mode={mode} state={state} focusTarget={focusTarget} />
    </box>
  )
}
