import { describe, expect, test } from "bun:test"

import { resolveArtworkFrameSize } from "../../src/ui/layout/artwork-layout"

describe("responsive artwork sizing", () => {
  test("uses bounded frames for large, medium, and compact decks", () => {
    expect(
      resolveArtworkFrameSize("large", {
        height: 40,
        width: 140,
      }),
    ).toEqual({ height: 27, width: 54 })
    expect(
      resolveArtworkFrameSize("medium", {
        height: 26,
        width: 90,
      }),
    ).toEqual({ height: 13, width: 26 })
    expect(
      resolveArtworkFrameSize("compact", {
        height: 22,
        width: 72,
      }),
    ).toEqual({ height: 3, width: 10 })
  })

  test("fills a tall large deck while bounding raster work", () => {
    expect(
      resolveArtworkFrameSize("large", {
        height: 70,
        width: 220,
      }),
    ).toEqual({ height: 45, width: 90 })
  })

  test("degrades compact art and disables it in too-small terminals", () => {
    expect(
      resolveArtworkFrameSize("compact", {
        height: 16,
        width: 52,
      }),
    ).toEqual({ height: 2, width: 6 })
    expect(
      resolveArtworkFrameSize("too-small", {
        height: 15,
        width: 51,
      }),
    ).toBeNull()
  })
})
