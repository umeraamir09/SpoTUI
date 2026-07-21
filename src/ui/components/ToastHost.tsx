import type { LayoutMode } from "../layout/layout"
import type { UiToast } from "../state/ui-controller"
import { useAppTheme } from "../theme/theme-context"

type FailureToast = UiToast & {
  tone: "error" | "warning"
}

export function ToastHost({
  toasts,
  mode,
  terminalWidth,
}: {
  toasts: readonly UiToast[]
  mode: LayoutMode
  terminalWidth: number
}) {
  if (toasts.length === 0 || mode !== "compact") {
    return null
  }

  return (
    <box
      position="absolute"
      zIndex={100}
      top={3}
      right={0}
      width={terminalWidth}
      flexDirection="column"
      alignItems="flex-end"
    >
      <ToastList toasts={toasts} />
    </box>
  )
}

export function ToastList({
  toasts,
}: {
  toasts: readonly UiToast[]
}) {
  const theme = useAppTheme()
  const visibleToasts = toasts.filter(isFailureToast).slice(-1)
  if (visibleToasts.length === 0) {
    return null
  }
  return (
    <>
      {visibleToasts.map((toast) => {
        const color = toastColor(toast, theme.colors)
        return (
          <box
            key={toast.id}
            width="100%"
            border={false}
            backgroundColor={theme.colors.surfaceRaised}
            paddingX={1}
            flexDirection="column"
          >
            <text fg={color}>
              <strong>{toastTitle(toast)}</strong>
            </text>
            <text fg={color}>{toast.message}</text>
          </box>
        )
      })}
    </>
  )
}

function isFailureToast(toast: UiToast): toast is FailureToast {
  return toast.tone === "error" || toast.tone === "warning"
}

function toastTitle(toast: FailureToast): string {
  switch (toast.tone) {
    case "error":
      return "CONNECTION ERROR"
    case "warning":
      return "NOTICE"
  }
}

function toastColor(
  toast: FailureToast,
  colors: {
    error: string
    accent: string
    accentSecondary: string
    textSecondary: string
  },
): string {
  switch (toast.tone) {
    case "error":
      return colors.error
    case "warning":
      return colors.accent
  }
}
