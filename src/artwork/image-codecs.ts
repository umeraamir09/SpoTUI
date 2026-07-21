import { decode as decodeJpeg } from "jpeg-js"
import { PNG } from "pngjs"

import type { DecodedImage } from "./types"

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const

export function decodeImageBytes(
  bytes: Uint8Array,
  mimeType: string | null,
): DecodedImage {
  const format = resolveFormat(bytes, mimeType)

  if (format === "png") {
    const decoded = PNG.sync.read(Buffer.from(bytes))
    return normalizeImage(
      decoded.width,
      decoded.height,
      decoded.data,
    )
  }

  const decoded = decodeJpeg(bytes, {
    formatAsRGBA: true,
    maxMemoryUsageInMB: 96,
    maxResolutionInMP: 20,
    tolerantDecoding: true,
    useTArray: true,
  })
  return normalizeImage(decoded.width, decoded.height, decoded.data)
}

function resolveFormat(
  bytes: Uint8Array,
  mimeType: string | null,
): "jpeg" | "png" {
  const normalizedMime = mimeType?.split(";", 1)[0]?.trim().toLowerCase()
  if (normalizedMime === "image/png") {
    return "png"
  }
  if (
    normalizedMime === "image/jpeg" ||
    normalizedMime === "image/jpg"
  ) {
    return "jpeg"
  }
  if (normalizedMime !== undefined) {
    throw new Error(`Unsupported artwork image format: ${normalizedMime}`)
  }

  if (
    PNG_SIGNATURE.every((value, index) => bytes[index] === value)
  ) {
    return "png"
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "jpeg"
  }
  throw new Error("Unsupported artwork image format")
}

function normalizeImage(
  width: number,
  height: number,
  data: Uint8Array,
): DecodedImage {
  if (
    width <= 0 ||
    height <= 0 ||
    data.length !== width * height * 4
  ) {
    throw new Error("Artwork decoder returned invalid pixel data")
  }
  return {
    data: new Uint8ClampedArray(data),
    height,
    width,
  }
}
