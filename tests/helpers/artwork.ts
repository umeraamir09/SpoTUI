import {
  createStaticArtworkController,
  type ArtworkControllerPort,
} from "../../src/artwork/artwork-service"
import {
  rasterizeSquareAlbumArt,
  rasterizeVinyl,
} from "../../src/artwork/cell-rasterizer"
import type {
  ArtworkFrame,
  ArtworkViewState,
  DecodedImage,
} from "../../src/artwork/types"

export async function createTestArtworkFrame(
  width: number,
  height: number,
): Promise<ArtworkFrame> {
  const imageWidth = 24
  const imageHeight = 24
  const data = new Uint8ClampedArray(
    imageWidth * imageHeight * 4,
  )
  for (let y = 0; y < imageHeight; y += 1) {
    for (let x = 0; x < imageWidth; x += 1) {
      const offset = (y * imageWidth + x) * 4
      data[offset] = 70 + x * 6
      data[offset + 1] = 45 + y * 5
      data[offset + 2] = 115 + ((x + y) % 8) * 12
      data[offset + 3] = 255
    }
  }
  const image: DecodedImage = {
    data,
    height: imageHeight,
    width: imageWidth,
  }
  return rasterizeVinyl(image, {
    angleRadians: Math.PI / 8,
    height,
    width,
    yieldControl: () => Promise.resolve(),
  })
}

export async function createTestStaticArtworkFrame(
  width: number,
  height: number,
): Promise<ArtworkFrame> {
  const imageWidth = 24
  const imageHeight = 24
  const data = new Uint8ClampedArray(imageWidth * imageHeight * 4)
  for (let y = 0; y < imageHeight; y += 1) {
    for (let x = 0; x < imageWidth; x += 1) {
      const offset = (y * imageWidth + x) * 4
      data[offset] = 70 + x * 6
      data[offset + 1] = 45 + y * 5
      data[offset + 2] = 115 + ((x + y) % 8) * 12
      data[offset + 3] = 255
    }
  }
  return rasterizeSquareAlbumArt(
    { data, height: imageHeight, width: imageWidth },
    {
      height,
      width,
      yieldControl: () => Promise.resolve(),
    },
  )
}

export function createReadyArtworkController(
  frame: ArtworkFrame,
  staticFrame: ArtworkFrame = frame,
): ArtworkControllerPort {
  return createStaticArtworkController({
    frame,
    message: null,
    rotating: true,
    sourceKey: "track:track-one",
    staticFrame,
    status: "ready",
  })
}

export function createArtworkControllerForState(
  state: ArtworkViewState,
): ArtworkControllerPort {
  return createStaticArtworkController(state)
}
