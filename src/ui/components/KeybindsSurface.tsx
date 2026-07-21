import {
  resolveLayoutMode,
  type TerminalDimensions,
} from "../layout/layout"
import { useAppTheme } from "../theme/theme-context"
import { AppHeader } from "./AppHeader"
import { PixelButton } from "./PixelButton"
import { TooSmallState } from "./TooSmallState"

export interface KeybindsSurfaceProps extends TerminalDimensions {
  onClose: () => void
}

interface KeybindEntry {
  keys: string
  action: string
}

const GENERAL_AND_PLAYER: readonly KeybindEntry[] = [
  { keys: "Q", action: "Quit player" },
  { keys: "ESC", action: "Back / close" },
  { keys: "TAB / SHIFT+TAB", action: "Move focus" },
  { keys: ",", action: "Theme settings" },
  { keys: "/  G  U  B", action: "Open pages" },
  { keys: "SPACE", action: "Play or pause" },
  { keys: "N / P", action: "Next / previous" },
  { keys: "H LEFT / L RIGHT", action: "Seek 5 seconds" },
  { keys: "SHIFT+H / SHIFT+L", action: "Seek 30 seconds" },
  { keys: "+ = / - / M", action: "Volume controls" },
  { keys: "S / R / D", action: "Modes / devices" },
  { keys: "Y / I", action: "Lyrics / info" },
  { keys: "UP DOWN / J K", action: "Lyrics scroll" },
]

const BROWSE_AND_AUTH: readonly KeybindEntry[] = [
  { keys: "SEARCH: TYPE", action: "Set query" },
  { keys: "SEARCH: DOWN", action: "Open results" },
  { keys: "SEARCH: UP DOWN / J K", action: "Select a result" },
  { keys: "SEARCH: ENTER / A", action: "Queue result" },
  { keys: "SEARCH: F / V / O", action: "Like / list / open" },
  { keys: "SEARCH: PGUP PGDN / /", action: "Page / edit" },
  { keys: "QUEUE: UP DOWN / J K", action: "Select queued item" },
  { keys: "QUEUE: ENTER", action: "Play queued" },
  { keys: "DEVICES: UP DOWN / J K", action: "Select device" },
  { keys: "DEVICES: ENTER", action: "Transfer; Shift plays" },
  { keys: "LIB: LEFT RIGHT / H L", action: "Change section" },
  { keys: "LIB: ENTER / P", action: "Open / play" },
  { keys: "LIB: A F BACKSPACE", action: "Queue / like / back" },
  { keys: "LIB: SHIFT+R / PGUP PGDN", action: "Reauth / page" },
  { keys: "AUTH: ENTER / ESC", action: "Submit / cancel" },
]

export function KeybindsSurface({
  onClose,
  ...dimensions
}: KeybindsSurfaceProps) {
  const theme = useAppTheme()
  const mode = resolveLayoutMode(dimensions)
  if (mode === "too-small") {
    return <TooSmallState {...dimensions} />
  }

  const compact = mode === "compact"
  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.colors.background}
    >
      <AppHeader mode={mode} />
      <box flexGrow={1} alignItems="center" justifyContent="center" padding={compact ? 0 : 1}>
        <box
          width={compact ? "100%" : 88}
          maxWidth={88}
          flexDirection="column"
          border={theme.presentation.borders}
          {...(theme.presentation.borders ? { borderColor: theme.colors.accentSecondary } : {})}
          backgroundColor={theme.colors.surface}
          padding={1}
        >
          <text fg={theme.colors.accent}><strong>KEYBINDS</strong></text>
          <text fg={theme.colors.textMuted}>
            Commands apply on the surface named before the colon.
          </text>
          {compact && dimensions.height < 22 ? (
            <text fg={theme.colors.textSecondary}>
              Resize to at least 22 rows to view the complete reference.
            </text>
          ) : compact ? (
            <KeybindColumn entries={[...GENERAL_AND_PLAYER, ...BROWSE_AND_AUTH]} />
          ) : (
            <box flexDirection="row" gap={2}>
              <KeybindColumn entries={GENERAL_AND_PLAYER} />
              <KeybindColumn entries={BROWSE_AND_AUTH} />
            </box>
          )}
          <box height={3} flexDirection="row" justifyContent="space-between" alignItems="center">
            <text fg={theme.colors.textMuted}>ESC closes this reference</text>
            <PixelButton id="keybinds-close" label="X" width={3} onPress={onClose} />
          </box>
        </box>
      </box>
    </box>
  )
}

function KeybindColumn({ entries }: { entries: readonly KeybindEntry[] }) {
  const theme = useAppTheme()
  return (
    <box flexDirection="column" flexGrow={1}>
      {entries.map((entry) => (
        <box key={entry.keys} flexDirection="row" gap={1}>
          <text width={23} fg={theme.colors.accentSecondary}>
            <strong>{entry.keys}</strong>
          </text>
          <text fg={theme.colors.textPrimary}>{entry.action}</text>
        </box>
      ))}
    </box>
  )
}
