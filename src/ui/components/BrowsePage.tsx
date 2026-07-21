import {
  resolveLayoutMode,
  type TerminalDimensions,
} from "../layout/layout"
import { useAppTheme } from "../theme/theme-context"
import { AppHeader } from "./AppHeader"
import { PixelButton } from "./PixelButton"
import { TooSmallState } from "./TooSmallState"
import type { AppPage } from "../navigation/page"

export function BrowsePage({
  onSearch,
  onNavigate,
  ...dimensions
}: TerminalDimensions & {
  onSearch: () => void
  onNavigate: (page: AppPage) => void
}) {
  const theme = useAppTheme()
  const mode = resolveLayoutMode(dimensions)
  if (mode === "too-small") {
    return <TooSmallState {...dimensions} />
  }

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={theme.colors.background}>
      <AppHeader mode={mode} activePage="browse" onNavigate={onNavigate} />
      <box flexGrow={1} flexDirection="column" padding={mode === "compact" ? 1 : 2} gap={1}>
        <text fg={theme.colors.accent}><strong>BROWSE</strong></text>
        <text fg={theme.colors.textPrimary}>
          Discover music from Spotify, starting with the tracks you want to hear.
        </text>
        <box
          border={theme.presentation.borders}
          {...(theme.presentation.borders ? { borderColor: theme.colors.border } : {})}
          backgroundColor={theme.colors.surface}
          flexDirection="column"
          padding={1}
          gap={1}
        >
          <text fg={theme.colors.accentSecondary}><strong>CATALOG DISCOVERY</strong></text>
          <text fg={theme.colors.textSecondary}>
            This Spotify connection currently exposes track search, your library, queue, and devices. Featured and recommendation feeds are not available through this application yet.
          </text>
          <PixelButton id="browse-search" label="SEARCH SPOTIFY" width={16} primary onPress={onSearch} />
        </box>
        <text fg={theme.colors.textMuted}>
          No unsupported recommendations or placeholder collections are shown.
        </text>
      </box>
    </box>
  )
}
