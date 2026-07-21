import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"

import type { VinylFrameRenderable } from "../../src/ui/renderables/vinyl-frame"
import "../../src/ui/renderables/vinyl-frame"
import { createTestArtworkFrame } from "../helpers/artwork"

const destroyers: (() => void)[] = []

afterEach(() => {
  act(() => {
    for (const destroy of destroyers.splice(0)) {
      destroy()
    }
  })
})

describe("vinyl framebuffer transparency", () => {
  test("preserves alpha outside the disc and through its center hole", async () => {
    const frame = await createTestArtworkFrame(18, 8)
    const harness = await testRender(
      <vinyl-frame
        id="transparent-vinyl"
        width={frame.width}
        height={frame.height}
        frame={frame}
      />,
      { width: frame.width, height: frame.height },
    )
    destroyers.push(() => {
      harness.renderer.destroy()
    })
    await harness.renderOnce()

    const renderable = harness.renderer.root.findDescendantById(
      "transparent-vinyl",
    ) as VinylFrameRenderable | undefined
    expect(renderable).toBeDefined()
    expect(renderable?.frameBuffer.respectAlpha).toBe(true)

    const spans = renderable?.frameBuffer
      .getSpanLines()
      .flatMap((line) => line.spans)
    expect(spans?.some((span) => span.bg.a === 0)).toBe(true)
  })
})
