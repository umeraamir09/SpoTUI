import type { LayoutMode, TerminalDimensions } from "./layout"

export interface ArtworkFrameSize {
  width: number
  height: number
}

export function resolveArtworkFrameSize(
  mode: LayoutMode,
  dimensions: TerminalDimensions,
): ArtworkFrameSize | null {
  if (mode === "too-small") {
    return null
  }
  if (dimensions.width >= 64 && dimensions.height >= 19) {
    if (mode === "compact") {
      return { height: 3, width: 10 }
    }
    const panelFraction = mode === "large" ? 0.44 : 0.38
    const panelOuterWidth = Math.floor(
      (dimensions.width - 3) * panelFraction,
    )
    const innerWidth = Math.max(8, panelOuterWidth - 4)
    const innerHeight = Math.max(4, dimensions.height - 13)
    const rawDiameter = Math.min(
      innerWidth,
      innerHeight * 2,
      96,
    )
    const diameter =
      rawDiameter % 2 === 0 ? rawDiameter : rawDiameter - 1
    return {
      height: diameter / 2,
      width: diameter,
    }
  }
  return { height: 2, width: 6 }
}
