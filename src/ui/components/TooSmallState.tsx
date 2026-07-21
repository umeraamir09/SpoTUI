import {
  MIN_TERMINAL_HEIGHT,
  MIN_TERMINAL_WIDTH,
  type TerminalDimensions,
} from "../layout/layout"
import { useAppTheme } from "../theme/theme-context"

export function TooSmallState({ width, height }: TerminalDimensions) {
  const theme = useAppTheme()
  return (
    <box
      width="100%"
      height="100%"
      backgroundColor={theme.colors.background}
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={1}
      padding={1}
    >
      <text fg={theme.colors.error}>
        <strong>TERMINAL TOO SMALL</strong>
      </text>
      <text fg={theme.colors.textPrimary}>
        Resize to at least {MIN_TERMINAL_WIDTH} x {MIN_TERMINAL_HEIGHT}
      </text>
      <text fg={theme.colors.textMuted}>
        Current size: {width} x {height}
      </text>
    </box>
  )
}
