export const MIN_TERMINAL_WIDTH = 52
export const MIN_TERMINAL_HEIGHT = 16

export type LayoutMode = "large" | "medium" | "compact" | "too-small"

export interface TerminalDimensions {
  width: number
  height: number
}

export function resolveLayoutMode({
  width,
  height,
}: TerminalDimensions): LayoutMode {
  if (width < MIN_TERMINAL_WIDTH || height < MIN_TERMINAL_HEIGHT) {
    return "too-small"
  }

  if (width < 76 || height < 24) {
    return "compact"
  }

  if (width >= 110 && height >= 30) {
    return "large"
  }

  return "medium"
}

