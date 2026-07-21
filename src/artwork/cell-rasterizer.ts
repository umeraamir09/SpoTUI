import {
  ARTWORK_CHARACTER_EMPTY,
  ARTWORK_CHARACTER_LOWER_HALF,
  ARTWORK_CHARACTER_UPPER_HALF,
  ARTWORK_TRANSPARENT_COLOR,
  type ArtworkFrame,
  type DecodedImage,
} from "./types"

export type RasterYield = () => Promise<void>
export type ArtworkCropMode = "cover" | "contain"

export interface VinylRasterOptions {
  width: number
  height: number
  angleRadians: number
  cropMode?: ArtworkCropMode
  focalX?: number
  focalY?: number
  yieldControl?: RasterYield
  yieldEveryRows?: number
}

export type SquareAlbumRasterOptions = Omit<
  VinylRasterOptions,
  "angleRadians"
>

interface Rgb {
  r: number
  g: number
  b: number
}

interface SampledPixel {
  color: number | null
  inside: boolean
  centerHole: boolean
}

interface RasterCell {
  character: string
  foreground: number | null
  background: number | null
}

interface DiscGeometry {
  flags: Uint8Array
  normalizedX: Float64Array
  normalizedY: Float64Array
  shadeFactor: Float64Array
}

interface ArtworkSamplingContext {
  cropMode: ArtworkCropMode
  cropSize: number
  focalOffsetX: number
  focalOffsetY: number
  presentedHeight: number
  presentedWidth: number
  squareSize: number
}

const INSIDE_DISC = 1
const CENTER_HOLE = 2
const MAX_GEOMETRY_CACHE_ENTRIES = 6
const GEOMETRY_CACHE = new Map<string, DiscGeometry>()
const BACKDROP: Rgb = { r: 21, g: 17, b: 13 }

const TRANSPARENT_PIXEL: SampledPixel = {
  color: null,
  inside: false,
  centerHole: false,
}

export async function rasterizeVinyl(
  image: DecodedImage,
  options: VinylRasterOptions,
): Promise<ArtworkFrame> {
  assertRasterInput(image, options)
  const yieldControl =
    options.yieldControl ??
    (() =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      }))
  const yieldEveryRows = Math.max(
    1,
    Math.floor(options.yieldEveryRows ?? 2),
  )
  const geometry = getDiscGeometry(options.width, options.height)
  const samplingContext = createSamplingContext(image, options)
  const cosine = Math.cos(options.angleRadians)
  const sine = Math.sin(options.angleRadians)
  const cellCount = options.width * options.height
  const characters = new Uint8Array(cellCount)
  const foreground = new Uint16Array(cellCount)
  const background = new Uint16Array(cellCount)
  const mask = new Uint8Array(cellCount)
  foreground.fill(ARTWORK_TRANSPARENT_COLOR)
  background.fill(ARTWORK_TRANSPARENT_COLOR)
  let artworkPixels = 0
  let centerHolePixels = 0

  for (let row = 0; row < options.height; row += 1) {
    for (let column = 0; column < options.width; column += 1) {
      const topIndex = row * 2 * options.width + column
      const bottomIndex = topIndex + options.width
      const top = sampleDiscPixel(
        image,
        geometry,
        topIndex,
        cosine,
        sine,
        samplingContext,
      )
      const bottom = sampleDiscPixel(
        image,
        geometry,
        bottomIndex,
        cosine,
        sine,
        samplingContext,
      )
      const cellIndex = row * options.width + column
      writeHalfBlock(
        cellIndex,
        top,
        bottom,
        characters,
        foreground,
        background,
      )
      mask[cellIndex] = top.inside || bottom.inside ? 1 : 0

      if (top.inside) {
        artworkPixels += 1
      }
      if (bottom.inside) {
        artworkPixels += 1
      }
      if (top.centerHole) {
        centerHolePixels += 1
      }
      if (bottom.centerHole) {
        centerHolePixels += 1
      }
    }

    if (
      (row + 1) % yieldEveryRows === 0 &&
      row + 1 < options.height
    ) {
      await yieldControl()
    }
  }

  return {
    angleRadians: normalizeAngle(options.angleRadians),
    background,
    characters,
    foreground,
    height: options.height,
    mask,
    stats: {
      artworkPixels,
      centerHolePixels,
    },
    width: options.width,
  }
}

export async function rasterizeSquareAlbumArt(
  image: DecodedImage,
  options: SquareAlbumRasterOptions,
): Promise<ArtworkFrame> {
  assertRasterInput(image, options)
  const yieldControl =
    options.yieldControl ??
    (() =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      }))
  const yieldEveryRows = Math.max(
    1,
    Math.floor(options.yieldEveryRows ?? 2),
  )
  const samplingContext = createSamplingContext(image, options)
  const cellCount = options.width * options.height
  const characters = new Uint8Array(cellCount)
  const foreground = new Uint16Array(cellCount)
  const background = new Uint16Array(cellCount)
  const mask = new Uint8Array(cellCount)

  for (let row = 0; row < options.height; row += 1) {
    for (let column = 0; column < options.width; column += 1) {
      const top = rgbToArtworkColor(
        sampleArtwork(
          image,
          (column + 0.5) / options.width,
          (row * 2 + 0.5) / (options.height * 2),
          samplingContext,
        ),
      )
      const bottom = rgbToArtworkColor(
        sampleArtwork(
          image,
          (column + 0.5) / options.width,
          (row * 2 + 1.5) / (options.height * 2),
          samplingContext,
        ),
      )
      const cellIndex = row * options.width + column
      characters[cellIndex] = ARTWORK_CHARACTER_UPPER_HALF
      foreground[cellIndex] = top
      background[cellIndex] = bottom
      mask[cellIndex] = 1
    }

    if (
      (row + 1) % yieldEveryRows === 0 &&
      row + 1 < options.height
    ) {
      await yieldControl()
    }
  }

  return {
    angleRadians: 0,
    background,
    characters,
    foreground,
    height: options.height,
    mask,
    stats: {
      artworkPixels: options.width * options.height * 2,
      centerHolePixels: 0,
    },
    width: options.width,
  }
}

function sampleDiscPixel(
  image: DecodedImage,
  geometry: DiscGeometry,
  pixelIndex: number,
  cosine: number,
  sine: number,
  samplingContext: ArtworkSamplingContext,
): SampledPixel {
  const flags = geometry.flags[pixelIndex] ?? 0
  if (flags === 0) {
    return TRANSPARENT_PIXEL
  }
  if ((flags & CENTER_HOLE) !== 0) {
    return {
      color: null,
      inside: false,
      centerHole: true,
    }
  }

  const normalizedX = geometry.normalizedX[pixelIndex] ?? 0
  const normalizedY = geometry.normalizedY[pixelIndex] ?? 0
  const rotatedX = cosine * normalizedX + sine * normalizedY
  const rotatedY = -sine * normalizedX + cosine * normalizedY
  const source = sampleArtwork(
    image,
    (rotatedX + 1) / 2,
    (rotatedY + 1) / 2,
    samplingContext,
  )

  return {
    color: rgbToArtworkColor(
      scaleRgb(source, geometry.shadeFactor[pixelIndex] ?? 1),
    ),
    inside: true,
    centerHole: false,
  }
}

function sampleArtwork(
  image: DecodedImage,
  normalizedX: number,
  normalizedY: number,
  context: ArtworkSamplingContext,
): Rgb {
  let sourceX: number
  let sourceY: number

  if (context.cropMode === "contain") {
    sourceX =
      ((normalizedX * context.squareSize -
        (context.squareSize - context.presentedWidth) / 2) /
        context.presentedWidth) *
      image.width
    sourceY =
      ((normalizedY * context.squareSize -
        (context.squareSize - context.presentedHeight) / 2) /
        context.presentedHeight) *
      image.height
  } else {
    sourceX =
      context.focalOffsetX + normalizedX * context.cropSize
    sourceY =
      context.focalOffsetY + normalizedY * context.cropSize
  }

  const x = Math.round(clamp(sourceX, 0, image.width - 1))
  const y = Math.round(clamp(sourceY, 0, image.height - 1))
  const offset = (y * image.width + x) * 4
  const alpha = (image.data[offset + 3] ?? 255) / 255

  return {
    r: blend(image.data[offset] ?? 0, BACKDROP.r, alpha),
    g: blend(image.data[offset + 1] ?? 0, BACKDROP.g, alpha),
    b: blend(image.data[offset + 2] ?? 0, BACKDROP.b, alpha),
  }
}

function createSamplingContext(
  image: DecodedImage,
  options: {
    width: number
    height: number
    cropMode?: ArtworkCropMode
    focalX?: number
    focalY?: number
  },
): ArtworkSamplingContext {
  const cropMode = options.cropMode ?? "cover"
  const cropSize = Math.min(image.width, image.height)
  const focalX = clamp(options.focalX ?? 0.5, 0, 1)
  const focalY = clamp(options.focalY ?? 0.5, 0, 1)
  const scale = Math.min(
    options.width / image.width,
    (options.height * 2) / image.height,
  )
  const presentedWidth = image.width * scale
  const presentedHeight = image.height * scale

  return {
    cropMode,
    cropSize,
    focalOffsetX: (image.width - cropSize) * focalX,
    focalOffsetY: (image.height - cropSize) * focalY,
    presentedHeight,
    presentedWidth,
    squareSize: Math.max(presentedWidth, presentedHeight),
  }
}

function getDiscGeometry(width: number, height: number): DiscGeometry {
  const key = `${String(width)}x${String(height)}`
  const cached = GEOMETRY_CACHE.get(key)
  if (cached !== undefined) {
    GEOMETRY_CACHE.delete(key)
    GEOMETRY_CACHE.set(key, cached)
    return cached
  }

  const pixelHeight = height * 2
  const pixelCount = width * pixelHeight
  const diameter = Math.min(width, pixelHeight)
  const radius = diameter / 2
  const centerX = width / 2
  const centerY = pixelHeight / 2
  const centerHoleRadius = Math.max(0.07, 0.9 / radius)
  const geometry: DiscGeometry = {
    flags: new Uint8Array(pixelCount),
    normalizedX: new Float64Array(pixelCount),
    normalizedY: new Float64Array(pixelCount),
    shadeFactor: new Float64Array(pixelCount),
  }

  for (let pixelY = 0; pixelY < pixelHeight; pixelY += 1) {
    for (let pixelX = 0; pixelX < width; pixelX += 1) {
      const pixelIndex = pixelY * width + pixelX
      const normalizedX = (pixelX + 0.5 - centerX) / radius
      const normalizedY = (pixelY + 0.5 - centerY) / radius
      const distance = Math.hypot(normalizedX, normalizedY)
      geometry.normalizedX[pixelIndex] = normalizedX
      geometry.normalizedY[pixelIndex] = normalizedY

      if (distance > 1) {
        continue
      }
      if (distance <= centerHoleRadius) {
        geometry.flags[pixelIndex] = CENTER_HOLE
        continue
      }

      geometry.flags[pixelIndex] = INSIDE_DISC
      const edgeShade = 1 - distance * distance * 0.23
      const highlight =
        normalizedX < -0.18 &&
        normalizedY < -0.05 &&
        distance > 0.42 &&
        distance < 0.9
          ? 1.08
          : 1
      const scanline = pixelY % 2 === 0 ? 0.98 : 1
      geometry.shadeFactor[pixelIndex] =
        edgeShade * highlight * scanline
    }
  }

  GEOMETRY_CACHE.set(key, geometry)
  if (GEOMETRY_CACHE.size > MAX_GEOMETRY_CACHE_ENTRIES) {
    const oldestKey = GEOMETRY_CACHE.keys().next().value
    if (oldestKey !== undefined) {
      GEOMETRY_CACHE.delete(oldestKey)
    }
  }
  return geometry
}

function writeHalfBlock(
  cellIndex: number,
  top: SampledPixel,
  bottom: SampledPixel,
  characters: Uint8Array,
  foreground: Uint16Array,
  background: Uint16Array,
): void {
  const cell = combineHalfBlock(top, bottom)
  characters[cellIndex] =
    !top.inside && !bottom.inside
      ? ARTWORK_CHARACTER_EMPTY
      : !top.inside
        ? ARTWORK_CHARACTER_LOWER_HALF
        : ARTWORK_CHARACTER_UPPER_HALF
  if (cell.foreground !== null) {
    foreground[cellIndex] = cell.foreground
  }
  if (cell.background !== null) {
    background[cellIndex] = cell.background
  }
}

function combineHalfBlock(
  top: SampledPixel,
  bottom: SampledPixel,
): RasterCell {
  if (!top.inside && !bottom.inside) {
    return {
      background: null,
      character: " ",
      foreground: null,
    }
  }
  if (!top.inside) {
    return {
      background: null,
      character: "▄",
      foreground: bottom.color,
    }
  }
  return {
    background: bottom.color,
    character: "▀",
    foreground: top.color,
  }
}

function scaleRgb(color: Rgb, factor: number): Rgb {
  return {
    r: clampByte(color.r * factor),
    g: clampByte(color.g * factor),
    b: clampByte(color.b * factor),
  }
}

function rgbToArtworkColor(color: Rgb): number {
  const red = Math.round(clampByte(color.r) / 17)
  const green = Math.round(clampByte(color.g) / 17)
  const blue = Math.round(clampByte(color.b) / 17)
  return (red << 8) | (green << 4) | blue
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function blend(
  foreground: number,
  background: number,
  alpha: number,
): number {
  return foreground * alpha + background * (1 - alpha)
}

function normalizeAngle(angle: number): number {
  const fullTurn = Math.PI * 2
  return ((angle % fullTurn) + fullTurn) % fullTurn
}

function assertRasterInput(
  image: DecodedImage,
  options: Pick<VinylRasterOptions, "width" | "height">,
): void {
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    image.data.length !== image.width * image.height * 4
  ) {
    throw new Error("Decoded artwork has invalid dimensions")
  }
  if (
    !Number.isInteger(options.width) ||
    !Number.isInteger(options.height) ||
    options.width <= 0 ||
    options.height <= 0
  ) {
    throw new Error("Artwork frame dimensions must be positive integers")
  }
}
