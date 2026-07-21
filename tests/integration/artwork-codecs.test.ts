import { describe, expect, test } from "bun:test"
import { encode as encodeJpeg } from "jpeg-js"
import { PNG } from "pngjs"

import { decodeImageBytes } from "../../src/artwork/image-codecs"
import { WorkerImageDecoder } from "../../src/artwork/image-decoder"

describe("artwork image codecs", () => {
  test("decodes PNG bytes into normalized RGBA pixels", () => {
    const bytes = createPngBytes()
    const image = decodeImageBytes(bytes, "image/png")

    expect(image.width).toBe(1)
    expect(image.height).toBe(1)
    expect(image.data).toHaveLength(4)
    expect(image.data[0]).toBe(220)
    expect(image.data[3]).toBe(255)
  })

  test("decodes off the input path in a worker", async () => {
    const decoder = new WorkerImageDecoder()
    try {
      const decoding = decoder.decode(createPngBytes(), "image/png")
      let settled = false
      void decoding.then(() => {
        settled = true
      })

      expect(settled).toBe(false)
      const image = await decoding
      expect(image).toMatchObject({ height: 1, width: 1 })
    } finally {
      decoder.dispose()
    }
  })

  test("reuses its worker without detaching Buffer-backed input", async () => {
    const decoder = new WorkerImageDecoder()
    const bytes = createPngBytes()
    const originalLength = bytes.byteLength
    try {
      const first = await decoder.decode(bytes, "image/png")
      const second = await decoder.decode(bytes, "image/png")

      expect(first.data).toEqual(second.data)
      expect(bytes.byteLength).toBe(originalLength)
    } finally {
      decoder.dispose()
    }
  })

  test("replaces an aborted worker and remains usable", async () => {
    const decoder = new WorkerImageDecoder()
    const abortController = new AbortController()
    try {
      const decoding = decoder.decode(
        createPngBytes(),
        "image/png",
        abortController.signal,
      )
      abortController.abort()

      let abortError: unknown
      try {
        await decoding
      } catch (error) {
        abortError = error
      }
      expect(abortError).toMatchObject({ name: "AbortError" })

      const recovered = await decoder.decode(
        createPngBytes(),
        "image/png",
      )
      expect(recovered).toMatchObject({ height: 1, width: 1 })
    } finally {
      decoder.dispose()
    }
  })

  test("decodes Spotify-compatible JPEG artwork into RGBA pixels", () => {
    const encoded = encodeJpeg(
      {
        data: new Uint8Array([30, 90, 210, 255]),
        height: 1,
        width: 1,
      },
      90,
    )
    const image = decodeImageBytes(encoded.data, "image/jpeg")

    expect(image).toMatchObject({ height: 1, width: 1 })
    expect(image.data).toHaveLength(4)
    expect(image.data[3]).toBe(255)
  })

  test("rejects unsupported artwork formats without guessing", () => {
    expect(() =>
      decodeImageBytes(new Uint8Array([1, 2, 3]), "image/webp"),
    ).toThrow("Unsupported artwork image format")
  })
})

function createPngBytes(): Uint8Array {
  const source = new PNG({ height: 1, width: 1 })
  source.data = Buffer.from([220, 40, 20, 255])
  return PNG.sync.write(source)
}
