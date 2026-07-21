import {
  FrameBufferRenderable,
  RGBA,
  type FrameBufferOptions,
  type RenderContext,
} from "@opentui/core"
import { extend } from "@opentui/react"

import {
  ARTWORK_CHARACTER_LOWER_HALF,
  ARTWORK_CHARACTER_UPPER_HALF,
  ARTWORK_TRANSPARENT_COLOR,
  type ArtworkFrame,
} from "../../artwork/types"

export interface VinylFrameOptions extends FrameBufferOptions {
  frame: ArtworkFrame | null
}

const TRANSPARENT = RGBA.fromValues(0, 0, 0, 0)
const ARTWORK_COLOR_COUNT = 4_096

export class VinylFrameRenderable extends FrameBufferRenderable {
  private currentFrame: ArtworkFrame | null | undefined
  private readonly colors = new Array<RGBA | undefined>(
    ARTWORK_COLOR_COUNT,
  )

  constructor(ctx: RenderContext, options: VinylFrameOptions) {
    super(ctx, {
      ...options,
      respectAlpha: true,
    })
    this.currentFrame = options.frame
    this.paintFrame()
  }

  set frame(frame: ArtworkFrame | null) {
    this.currentFrame = frame
    this.paintFrame()
  }

  get frame(): ArtworkFrame | null {
    return this.currentFrame ?? null
  }

  protected override onResize(width: number, height: number): void {
    super.onResize(width, height)
    this.paintFrame()
  }

  private paintFrame(): void {
    if (this.currentFrame === undefined) {
      return
    }
    const availableWidth =
      typeof this.width === "number" ? this.width : 0
    const availableHeight =
      typeof this.height === "number" ? this.height : 0
    this.frameBuffer.fillRect(
      0,
      0,
      availableWidth,
      availableHeight,
      TRANSPARENT,
    )
    if (this.currentFrame === null) {
      return
    }

    const drawWidth = Math.min(
      availableWidth,
      this.currentFrame.width,
    )
    const drawHeight = Math.min(
      availableHeight,
      this.currentFrame.height,
    )
    for (let y = 0; y < drawHeight; y += 1) {
      for (let x = 0; x < drawWidth; x += 1) {
        const cellIndex = y * this.currentFrame.width + x
        this.frameBuffer.setCell(
          x,
          y,
          resolveCharacter(
            this.currentFrame.characters[cellIndex] ?? 0,
          ),
          this.resolveColor(
            this.currentFrame.foreground[cellIndex] ??
              ARTWORK_TRANSPARENT_COLOR,
          ),
          this.resolveColor(
            this.currentFrame.background[cellIndex] ??
              ARTWORK_TRANSPARENT_COLOR,
          ),
        )
      }
    }
  }

  private resolveColor(color: number): RGBA {
    if (color === ARTWORK_TRANSPARENT_COLOR) {
      return TRANSPARENT
    }
    const cached = this.colors[color]
    if (cached !== undefined) {
      return cached
    }
    const parsed = RGBA.fromInts(
      ((color >> 8) & 0xf) * 17,
      ((color >> 4) & 0xf) * 17,
      (color & 0xf) * 17,
    )
    this.colors[color] = parsed
    return parsed
  }
}

function resolveCharacter(code: number): string {
  if (code === ARTWORK_CHARACTER_UPPER_HALF) {
    return "\u2580"
  }
  if (code === ARTWORK_CHARACTER_LOWER_HALF) {
    return "\u2584"
  }
  return " "
}

extend({ "vinyl-frame": VinylFrameRenderable })

declare module "@opentui/react" {
  interface OpenTUIComponents {
    "vinyl-frame": typeof VinylFrameRenderable
  }
}
