import { describe, expect, test } from "bun:test"

import {
  rasterizeSquareAlbumArt,
  rasterizeVinyl,
  type RasterYield,
} from "../../src/artwork/cell-rasterizer"
import {
  ARTWORK_TRANSPARENT_COLOR,
  type DecodedImage,
} from "../../src/artwork/types"

function stripedImage(): DecodedImage {
  const width = 8
  const height = 8
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const left = x < width / 2
      data[offset] = left ? 220 : 24
      data[offset + 1] = 44
      data[offset + 2] = left ? 24 : 220
      data[offset + 3] = 255
    }
  }

  return { data, height, width }
}

describe("vinyl cell rasterizer", () => {
  test("renders static square album art without transparent corners or a center hole", async () => {
    const frame = await rasterizeSquareAlbumArt(stripedImage(), {
      height: 8,
      width: 18,
    })

    expect(frame.angleRadians).toBe(0)
    expect(frame.stats.centerHolePixels).toBe(0)
    expect(frame.stats.artworkPixels).toBe(18 * 8 * 2)
    expect(frame.mask.every((pixel) => pixel === 1)).toBe(true)
    expect(
      frame.foreground.every(
        (color) => color !== ARTWORK_TRANSPARENT_COLOR,
      ),
    ).toBe(true)
    expect(
      frame.background.every(
        (color) => color !== ARTWORK_TRANSPARENT_COLOR,
      ),
    ).toBe(true)
  })

  test("uses artwork across the circular face with a transparent center hole", async () => {
    const frame = await rasterizeVinyl(stripedImage(), {
      angleRadians: 0,
      height: 8,
      width: 18,
    })

    expect(frame.width).toBe(18)
    expect(frame.height).toBe(8)
    expect(frame.stats.artworkPixels).toBeGreaterThan(100)
    expect(frame.stats.centerHolePixels).toBeGreaterThan(0)
    expect(
      frame.foreground.some(
        (color, index) =>
          frame.mask[index] === 0 &&
          color === ARTWORK_TRANSPARENT_COLOR &&
          frame.background[index] === ARTWORK_TRANSPARENT_COLOR,
      ),
    ).toBe(true)

    const colors = [
      ...frame.foreground,
      ...frame.background,
    ].filter((color) => color !== ARTWORK_TRANSPARENT_COLOR)
    expect(colors.some((color) => channel(color, 0) > channel(color, 2))).toBe(
      true,
    )
    expect(colors.some((color) => channel(color, 2) > channel(color, 0))).toBe(
      true,
    )
  })

  test("rotates the sampled full-face artwork without changing the disc mask", async () => {
    const source = stripedImage()
    const first = await rasterizeVinyl(source, {
      angleRadians: 0,
      height: 7,
      width: 16,
    })
    const rotated = await rasterizeVinyl(source, {
      angleRadians: Math.PI,
      height: 7,
      width: 16,
    })

    expect(rotated.mask).toEqual(first.mask)
    expect(rotated.foreground).not.toEqual(first.foreground)
    expect(rotated.stats.centerHolePixels).toBe(
      first.stats.centerHolePixels,
    )
  })

  test("yields between raster batches so input processing can continue", async () => {
    let yields = 0
    const yieldControl: RasterYield = () => {
      yields += 1
      return Promise.resolve()
    }

    await rasterizeVinyl(stripedImage(), {
      angleRadians: 0,
      height: 10,
      width: 20,
      yieldControl,
      yieldEveryRows: 2,
    })

    expect(yields).toBeGreaterThanOrEqual(4)
  })

  test("stores rendered frames in bounded typed buffers", async () => {
    const frame = await rasterizeVinyl(stripedImage(), {
      angleRadians: 0,
      height: 8,
      width: 18,
      yieldEveryRows: 8,
    })

    expect(frame.characters).toBeInstanceOf(Uint8Array)
    expect(frame.foreground).toBeInstanceOf(Uint16Array)
    expect(frame.background).toBeInstanceOf(Uint16Array)
    expect(frame.mask).toBeInstanceOf(Uint8Array)
    const retainedBytes =
      frame.characters.byteLength +
      frame.foreground.byteLength +
      frame.background.byteLength +
      frame.mask.byteLength
    expect(retainedBytes).toBe(frame.width * frame.height * 6)
  })
})

function channel(color: number, channelIndex: number): number {
  const shift = (2 - channelIndex) * 4
  return ((color >> shift) & 0xf) * 17
}
