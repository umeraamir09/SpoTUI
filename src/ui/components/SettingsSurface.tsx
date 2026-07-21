import type { ThemePresetName } from "../theme/palette"
import {
  resolveLayoutMode,
  type TerminalDimensions,
} from "../layout/layout"
import { useAppTheme } from "../theme/theme-context"
import { AppHeader } from "./AppHeader"
import { PixelButton } from "./PixelButton"
import { TooSmallState } from "./TooSmallState"

export type SettingsSaveStatus =
  | "idle"
  | "saving"
  | "error"

export interface SettingsSurfaceProps extends TerminalDimensions {
  selectedTheme: ThemePresetName
  committedTheme: ThemePresetName
  saveStatus: SettingsSaveStatus
  onSelect: (preset: ThemePresetName) => void
  onApply: () => void
  onCancel: () => void
}

const THEME_CATEGORIES: { label: string; themes: ThemePresetName[] }[] = [
  {
    label: "DARK",
    themes: [
      "warm-phosphor",
      "midnight-blue",
      "forest-terminal",
      "rosewave",
      "tokyo-night",
      "dracula",
      "catppuccin-mocha",
      "nord",
      "solarized-dark",
      "synthwave",
      "gruvbox-dark",
      "ayu-mirage",
    ],
  },
  {
    label: "LIGHT",
    themes: [
      "paper-light",
      "solarized-light",
      "catppuccin-latte",
      "rose-pine-dawn",
    ],
  },
]

const THEME_DESCRIPTIONS: Record<ThemePresetName, string> = {
  "warm-phosphor": "Amber studio receiver",
  "midnight-blue": "Cool nocturnal console",
  "forest-terminal": "Deep green listening room",
  rosewave: "Magenta late-night signal",
  "tokyo-night": "Electric Tokyo twilight",
  dracula: "Gothic vampire palette",
  "catppuccin-mocha": "Warm creamy dark",
  nord: "Frosty arctic tundra",
  "solarized-dark": "Precision engineer's dusk",
  synthwave: "Neon retro '84",
  "gruvbox-dark": "Retro workshop wood",
  "ayu-mirage": "Warm desert dusk",
  "paper-light": "Warm cream paper",
  "solarized-light": "Solar precision dawn",
  "catppuccin-latte": "Smooth creamy morning",
  "rose-pine-dawn": "Soft rose garden",
}

export function SettingsSurface({
  selectedTheme,
  committedTheme,
  saveStatus,
  onSelect,
  onApply,
  onCancel,
  ...dimensions
}: SettingsSurfaceProps) {
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
      <box
        flexGrow={1}
        alignItems="center"
        padding={compact ? 0 : 1}
      >
        <box
          width={compact ? "100%" : 64}
          maxWidth={64}
          flexDirection="column"
          backgroundColor={theme.colors.background}
          paddingX={1}
          height="100%"
        >
          <text fg={theme.colors.accent}>
            <strong>THEME SETTINGS</strong>
          </text>
          <text fg={theme.colors.textMuted}>
            {compact
              ? "Up/Down preview · Enter apply · Esc cancel"
              : "Select a preset to preview it live. Apply saves it for future launches."}
          </text>
          <scrollbox scrollY={true} flexGrow={1}>
          {THEME_CATEGORIES.map((category) => (
            <box key={category.label} flexDirection="column" width="100%">
              {compact ? null : (
                <box
                  backgroundColor={theme.colors.surface}
                  width="100%"
                  paddingX={1}
                >
                  <text fg={theme.colors.textMuted}>
                    <strong>{category.label}</strong>
                  </text>
                </box>
              )}
              {category.themes.map((preset) => {
                const selected = preset === selectedTheme
                const committed = preset === committedTheme
                return (
                  <box
                    key={preset}
                    id={`theme-option-${preset}`}
                    height={compact ? 1 : 3}
                    width="100%"
                    flexDirection="column"
                    paddingX={1}
                    backgroundColor={
                      selected
                        ? theme.colors.surfaceRaised
                        : theme.colors.background
                    }
                    onMouseDown={(event) => {
                      if (event.button !== 0) {
                        return
                      }
                      event.stopPropagation()
                      onSelect(preset)
                    }}
                  >
                    <text
                      fg={
                        selected
                          ? theme.colors.accent
                          : theme.colors.textPrimary
                      }
                    >
                      {selected ? "> " : "  "}
                      <strong>{preset.toUpperCase()}</strong>
                      {committed ? "  SAVED" : ""}
                    </text>
                    {compact ? null : (
                      <text fg={theme.colors.textMuted}>
                        {"  "}
                        {THEME_DESCRIPTIONS[preset]}
                      </text>
                    )}
                  </box>
                )
              })}
            </box>
          ))}
          </scrollbox>
          <box
            height={3}
            width="100%"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <text
              fg={
                saveStatus === "error"
                  ? theme.colors.error
                  : theme.colors.textMuted
              }
            >
              {saveStatus === "saving"
                ? "SAVING..."
                : saveStatus === "error"
                  ? "COULD NOT SAVE THEME"
                  : "PREVIEW UPDATES IMMEDIATELY"}
            </text>
            <box flexDirection="row" gap={1}>
              <PixelButton
                id="settings-cancel"
                label="X"
                width={3}
                onPress={onCancel}
              />
              <PixelButton
                id="settings-apply"
                label="OK"
                width={4}
                disabled={saveStatus === "saving"}
                primary
                onPress={onApply}
              />
            </box>
          </box>
        </box>
      </box>
    </box>
  )
}
