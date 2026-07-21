import { describe, expect, test } from "bun:test"

import {
  ArtworkService,
  type ArtworkServiceOptions,
} from "../../src/artwork/artwork-service"
import type {
  ArtworkFrame,
  DecodedImage,
} from "../../src/artwork/types"
import {
  ARTWORK_CHARACTER_UPPER_HALF,
} from "../../src/artwork/types"
import type { VinylRasterOptions } from "../../src/artwork/cell-rasterizer"

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve: (value) => {
      resolvePromise?.(value)
    },
  }
}

const IMAGE: DecodedImage = {
  data: new Uint8ClampedArray([200, 80, 30, 255]),
  height: 1,
  width: 1,
}

const LEGACY_FRAME = {
  angleRadians: 0,
  cells: [
    {
      background: "#C8501E",
      character: "▀",
      foreground: "#C8501E",
    },
  ],
  height: 1,
  mask: [true],
  stats: {
    artworkPixels: 2,
    centerHolePixels: 1,
  },
  width: 1,
}

const FRAME: ArtworkFrame = {
  angleRadians: LEGACY_FRAME.angleRadians,
  background: new Uint16Array([0xc51]),
  characters: new Uint8Array([
    ARTWORK_CHARACTER_UPPER_HALF,
  ]),
  foreground: new Uint16Array([0xc51]),
  height: LEGACY_FRAME.height,
  mask: new Uint8Array([1]),
  stats: LEGACY_FRAME.stats,
  width: LEGACY_FRAME.width,
}

function options(
  overrides: Partial<ArtworkServiceOptions> = {},
): ArtworkServiceOptions {
  return {
    decode: () => Promise.resolve(IMAGE),
    fetchBytes: () =>
      Promise.resolve({
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "image/jpeg",
      }),
    rasterize: () => Promise.resolve(FRAME),
    ...overrides,
  }
}

describe("artwork service", () => {
  test("ignores stale track work after a newer source wins", async () => {
    const first = deferred<{
      bytes: Uint8Array
      mimeType: string | null
    }>()
    const second = deferred<{
      bytes: Uint8Array
      mimeType: string | null
    }>()
    const service = new ArtworkService(
      options({
        fetchBytes: (url) =>
          url.endsWith("first") ? first.promise : second.promise,
      }),
    )

    service.setArtwork({
      animations: true,
      height: 6,
      isPlaying: true,
      key: "track:first",
      url: "https://image/first",
      width: 12,
    })
    service.setArtwork({
      animations: true,
      height: 6,
      isPlaying: true,
      key: "track:second",
      url: "https://image/second",
      width: 12,
    })

    second.resolve({
      bytes: new Uint8Array([2]),
      mimeType: "image/jpeg",
    })
    await service.whenIdle()
    first.resolve({
      bytes: new Uint8Array([1]),
      mimeType: "image/jpeg",
    })
    await Promise.resolve()

    expect(service.getSnapshot().sourceKey).toBe("track:second")
    expect(service.getSnapshot().status).toBe("ready")
  })

  test("returns immediately while decoding continues asynchronously", async () => {
    const decoding = deferred<DecodedImage>()
    const service = new ArtworkService(
      options({
        decode: () => decoding.promise,
      }),
    )

    service.setArtwork({
      animations: false,
      height: 6,
      isPlaying: false,
      key: "track:slow",
      url: "https://image/slow",
      width: 12,
    })

    expect(service.getSnapshot().status).toBe("loading")
    decoding.resolve(IMAGE)
    await service.whenIdle()
    expect(service.getSnapshot().status).toBe("ready")
  })

  test("stops scheduling rotation when playback pauses", async () => {
    const scheduled: (() => void)[] = []
    const service = new ArtworkService(
      options({
        clearTimer: () => undefined,
        setTimer: (callback) => {
          scheduled.push(callback)
          return 1 as unknown as ReturnType<typeof setTimeout>
        },
      }),
    )
    const playing = {
      animations: true,
      height: 6,
      isPlaying: true,
      key: "track:one",
      url: "https://image/one",
      width: 12,
    } as const

    service.setArtwork(playing)
    await service.whenIdle()
    expect(scheduled.length).toBe(1)

    service.setArtwork({ ...playing, isPlaying: false })
    scheduled[0]?.()
    await service.whenIdle()

    expect(service.getSnapshot().rotating).toBe(false)
    expect(scheduled.length).toBe(1)
  })

  test("renders animation frames at a bounded cadence without timer-yielding each raster row", async () => {
    const scheduled: {
      callback: () => void
      milliseconds: number
    }[] = []
    const rasterOptions: VinylRasterOptions[] = []
    const service = new ArtworkService(
      options({
        rasterize: (_image, rasterOption) => {
          rasterOptions.push(rasterOption)
          return Promise.resolve(FRAME)
        },
        setTimer: (callback, milliseconds) => {
          scheduled.push({ callback, milliseconds })
          return 1 as unknown as ReturnType<typeof setTimeout>
        },
      }),
    )

    service.setArtwork({
      animations: true,
      height: 12,
      isPlaying: true,
      key: "track:smooth",
      url: "https://image/smooth",
      width: 24,
    })
    await service.whenIdle()
    scheduled[0]?.callback()
    await service.whenIdle()

    expect(scheduled[0]?.milliseconds).toBeGreaterThanOrEqual(160)
    expect(scheduled[0]?.milliseconds).toBeLessThanOrEqual(200)
    expect(rasterOptions[1]?.yieldEveryRows).toBe(12)
  })

  test("reuses a bounded set of frames after one complete revolution", async () => {
    const scheduled: (() => void)[] = []
    let rasterCount = 0
    const service = new ArtworkService(
      options({
        rasterize: () => {
          rasterCount += 1
          return Promise.resolve(FRAME)
        },
        setTimer: (callback) => {
          scheduled.push(callback)
          return scheduled.length as unknown as ReturnType<
            typeof setTimeout
          >
        },
      }),
    )

    service.setArtwork({
      animations: true,
      height: 12,
      isPlaying: true,
      key: "track:bounded-frames",
      url: "https://image/bounded-frames",
      width: 24,
    })
    await service.whenIdle()

    for (let index = 0; index < 24; index += 1) {
      scheduled.shift()?.()
      await service.whenIdle()
    }

    expect(rasterCount).toBe(24)
    service.stop()
  })

  test("stops rotation while the terminal is unfocused or animations are disabled", async () => {
    const scheduled: (() => void)[] = []
    const service = new ArtworkService(
      options({
        clearTimer: () => undefined,
        setTimer: (callback) => {
          scheduled.push(callback)
          return 1 as unknown as ReturnType<typeof setTimeout>
        },
      }),
    )
    const request = {
      animations: true,
      height: 6,
      isPlaying: true,
      key: "track:focus",
      url: "https://image/focus",
      width: 12,
    } as const

    service.setArtwork(request)
    await service.whenIdle()
    service.setTerminalFocused(false)
    expect(service.getSnapshot().rotating).toBe(false)

    service.setTerminalFocused(true)
    expect(service.getSnapshot().rotating).toBe(true)
    service.setArtwork({ ...request, animations: false })
    expect(service.getSnapshot().rotating).toBe(false)
  })

  test("falls back safely if a later rotation frame cannot be rasterized", async () => {
    const scheduled: (() => void)[] = []
    let renders = 0
    const service = new ArtworkService(
      options({
        rasterize: () => {
          renders += 1
          return renders === 1
            ? Promise.resolve(FRAME)
            : Promise.reject(new Error("rotation failed"))
        },
        setTimer: (callback) => {
          scheduled.push(callback)
          return 1 as unknown as ReturnType<typeof setTimeout>
        },
      }),
    )
    service.setArtwork({
      animations: true,
      height: 6,
      isPlaying: true,
      key: "track:rotation-error",
      url: "https://image/rotation-error",
      width: 12,
    })
    await service.whenIdle()

    scheduled[0]?.()
    await service.whenIdle()

    expect(service.getSnapshot()).toMatchObject({
      frame: null,
      rotating: false,
      status: "error",
    })
  })

  test("uses a no-art fallback state when Spotify has no image", () => {
    const service = new ArtworkService(options())
    service.setArtwork({
      animations: true,
      height: 6,
      isPlaying: true,
      key: "episode:no-cover",
      url: null,
      width: 12,
    })

    expect(service.getSnapshot()).toMatchObject({
      frame: null,
      sourceKey: "episode:no-cover",
      status: "unavailable",
    })
  })
})
