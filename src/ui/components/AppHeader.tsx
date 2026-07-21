import type { LayoutMode } from "../layout/layout"
import type { AppPage } from "../navigation/page"
import { APP_PAGES, PAGE_LABELS } from "../navigation/page"
import { useAppTheme } from "../theme/theme-context"
import { useUiAnimationActive } from "../animation/animation-context"
import { useEffect, useState } from "react"

export interface AppHeaderProps {
  mode: Exclude<LayoutMode, "too-small">
  activePage?: AppPage | undefined
  onNavigate?: ((page: AppPage) => void) | undefined
  onOpenSettings?: (() => void) | undefined
  onOpenKeybinds?: (() => void) | undefined
  animated?: boolean | undefined
}

export function AppHeader({
  mode,
  activePage,
  onNavigate,
  onOpenSettings,
  onOpenKeybinds,
  animated,
}: AppHeaderProps) {
  const theme = useAppTheme()
  const animationActive = useUiAnimationActive()
  const showNavigation =
    activePage !== undefined && activePage !== "player" && mode !== "compact"

  return (
    <box
      border={theme.presentation.borders ? ["bottom"] : false}
      {...(theme.presentation.borders
        ? { borderColor: theme.colors.border }
        : {})}
      height={showNavigation ? 4 : 3}
      paddingX={1}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      backgroundColor={theme.colors.background}
    >
      {showNavigation ? (
        <box flexDirection="column" flexGrow={1}>
          <box flexDirection="row" justifyContent="space-between">
            <text fg={theme.colors.accent}>
              <SpoTUIWordmark animated={animated ?? animationActive} />
            </text>
          </box>
          <box flexDirection="row" gap={1}>
            {APP_PAGES.map((page) => (
              <text
                key={page}
                fg={page === activePage ? theme.colors.accent : theme.colors.textMuted}
                onMouseDown={(event) => {
                  if (event.button === 0) {
                    event.stopPropagation()
                    onNavigate?.(page)
                  }
                }}
              >
                {page === activePage ? "> " : "  "}{PAGE_LABELS[page].toUpperCase()}
              </text>
            ))}
          </box>
        </box>
      ) : (
        <>
          <text fg={theme.colors.accent}>
            <SpoTUIWordmark animated={animated ?? animationActive} />
          </text>
          <box height={1} flexDirection="row" alignItems="center" gap={1}>
            <HeaderActions
              onOpenSettings={onOpenSettings}
              onOpenKeybinds={onOpenKeybinds}
            />
          </box>
        </>
      )}
      {showNavigation ? (
        <HeaderActions
          onOpenSettings={onOpenSettings}
          onOpenKeybinds={onOpenKeybinds}
        />
      ) : null}
    </box>
  )
}

function HeaderActions({
  onOpenSettings,
  onOpenKeybinds,
}: Pick<AppHeaderProps, "onOpenSettings" | "onOpenKeybinds">) {
  if (onOpenSettings === undefined && onOpenKeybinds === undefined) {
    return null
  }
  return (
    <box height={1} flexDirection="row" alignItems="center" gap={1}>
      {onOpenKeybinds === undefined ? null : (
        <HeaderAction
          id="keybinds-open"
          label="KEYS"
          onPress={onOpenKeybinds}
        />
      )}
      {onOpenSettings === undefined ? null : (
        <HeaderAction
          id="settings-open"
          label="THEME"
          onPress={onOpenSettings}
        />
      )}
    </box>
  )
}

function HeaderAction({
  id,
  label,
  onPress,
}: {
  id: string
  label: string
  onPress: () => void
}) {
  const theme = useAppTheme()
  return (
    <box
      id={id}
      height={1}
      width={label.length + 2}
      alignItems="center"
      justifyContent="center"
      backgroundColor={theme.colors.surfaceRaised}
      onMouseDown={(event) => {
        if (event.button !== 0) {
          return
        }
        event.stopPropagation()
        onPress()
      }}
    >
      <text fg={theme.colors.accent}><strong>{label}</strong></text>
    </box>
  )
}

function SpoTUIWordmark({ animated }: { animated: boolean }) {
  const theme = useAppTheme()
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!animated) {
      setFrame(0)
      return
    }
    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % 4)
    }, 320)
    return () => {
      clearInterval(timer)
    }
  }, [animated])

  const scanner = theme.presentation.unicode
    ? ["·", "•", "◉", "•"][frame]
    : [".", "o", "O", "o"][frame]

  return (
    <>
      <strong>Spo</strong>
      <span fg={frame === 2 ? theme.colors.accentSecondary : theme.colors.accent}>
        TUI
      </span>
      <span fg={theme.colors.textMuted}> {scanner}</span>
    </>
  )
}
