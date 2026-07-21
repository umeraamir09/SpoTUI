import { ArtworkCache } from "./artwork-cache"
import {
  rasterizeSquareAlbumArt,
  rasterizeVinyl,
  type SquareAlbumRasterOptions,
  type VinylRasterOptions,
} from "./cell-rasterizer"
import { WorkerImageDecoder } from "./image-decoder"
import type {
  ArtworkBytes,
  ArtworkFrame,
  ArtworkRequest,
  ArtworkViewState,
  DecodedImage,
} from "./types"

const MAX_ARTWORK_BYTES = 12 * 1024 * 1024
const MAX_DECODED_CACHE_BYTES = 8 * 1024 * 1024
const MAX_FRAME_CACHE_BYTES = 2 * 1024 * 1024
const ROTATION_FRAME_COUNT = 24
const ROTATION_INTERVAL_MS = 180
const ROTATION_STEP_RADIANS =
  (Math.PI * 2) / ROTATION_FRAME_COUNT

export interface ArtworkControllerPort {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => ArtworkViewState
  setArtwork: (request: ArtworkRequest | null) => void
  setTerminalFocused: (focused: boolean) => void
  stop: () => void
  whenIdle: () => Promise<void>
}

export interface ArtworkServiceOptions {
  fetchBytes?: (
    url: string,
    signal?: AbortSignal,
  ) => Promise<ArtworkBytes>
  decode?: (
    bytes: Uint8Array,
    mimeType: string | null,
    signal?: AbortSignal,
  ) => Promise<DecodedImage>
  rasterize?: (
    image: DecodedImage,
    options: VinylRasterOptions,
  ) => Promise<ArtworkFrame>
  rasterizeStatic?: (
    image: DecodedImage,
    options: SquareAlbumRasterOptions,
  ) => Promise<ArtworkFrame>
  setTimer?: (
    callback: () => void,
    milliseconds: number,
  ) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
  decodedCacheSize?: number
  frameCacheSize?: number
}

const INITIAL_STATE: ArtworkViewState = {
  frame: null,
  message: null,
  rotating: false,
  sourceKey: null,
  staticFrame: null,
  status: "idle",
}

export class ArtworkService implements ArtworkControllerPort {
  private readonly fetchBytes: NonNullable<
    ArtworkServiceOptions["fetchBytes"]
  >
  private readonly decode: NonNullable<ArtworkServiceOptions["decode"]>
  private readonly rasterize: NonNullable<
    ArtworkServiceOptions["rasterize"]
  >
  private readonly rasterizeStatic: NonNullable<
    ArtworkServiceOptions["rasterizeStatic"]
  >
  private readonly setTimer: NonNullable<
    ArtworkServiceOptions["setTimer"]
  >
  private readonly clearTimer: NonNullable<
    ArtworkServiceOptions["clearTimer"]
  >
  private readonly decodedCache: ArtworkCache<DecodedImage>
  private readonly frameCache: ArtworkCache<ArtworkFrame>
  private readonly disposeDecoder: (() => void) | null
  private readonly listeners = new Set<() => void>()

  private state = INITIAL_STATE
  private request: ArtworkRequest | null = null
  private currentImage: DecodedImage | null = null
  private generation = 0
  private rotationFrameIndex = 0
  private angleRadians = 0
  private terminalFocused = true
  private abortController: AbortController | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private work: Promise<void> = Promise.resolve()

  constructor({
    fetchBytes = fetchArtworkBytes,
    decode,
    rasterize = rasterizeVinyl,
    rasterizeStatic = rasterizeSquareAlbumArt,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    decodedCacheSize = 2,
    frameCacheSize = ROTATION_FRAME_COUNT,
  }: ArtworkServiceOptions = {}) {
    this.fetchBytes = fetchBytes
    if (decode === undefined) {
      const workerDecoder = new WorkerImageDecoder()
      this.decode = workerDecoder.decode.bind(workerDecoder)
      this.disposeDecoder = () => {
        workerDecoder.dispose()
      }
    } else {
      this.decode = decode
      this.disposeDecoder = null
    }
    this.rasterize = rasterize
    this.rasterizeStatic = rasterizeStatic
    this.setTimer = setTimer
    this.clearTimer = clearTimer
    this.decodedCache = new ArtworkCache(decodedCacheSize, {
      maxWeight: MAX_DECODED_CACHE_BYTES,
      weigh: (image) => image.data.byteLength,
    })
    this.frameCache = new ArtworkCache(frameCacheSize, {
      maxWeight: MAX_FRAME_CACHE_BYTES,
      weigh: artworkFrameBytes,
    })
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): ArtworkViewState => this.state

  setArtwork(request: ArtworkRequest | null): void {
    const sourceChanged = !sameSource(this.request, request)
    this.request = request

    if (!sourceChanged) {
      this.syncAnimation()
      return
    }

    this.generation += 1
    this.abortController?.abort()
    this.abortController = null
    this.clearAnimationTimer()
    this.currentImage = null
    this.rotationFrameIndex = 0
    this.angleRadians = 0

    if (request === null) {
      this.setState(INITIAL_STATE)
      return
    }
    if (request.url === null) {
      this.setState({
        frame: null,
        message: "Spotify did not provide artwork for this item.",
        rotating: false,
        sourceKey: request.key,
        staticFrame: null,
        status: "unavailable",
      })
      return
    }

    this.setState({
      frame: null,
      message: null,
      rotating: false,
      sourceKey: request.key,
      staticFrame: null,
      status: "loading",
    })
    const generation = this.generation
    const abortController = new AbortController()
    this.abortController = abortController
    this.work = this.loadAndRender(
      { ...request, url: request.url },
      generation,
      abortController.signal,
    )
  }

  setTerminalFocused(focused: boolean): void {
    this.terminalFocused = focused
    this.syncAnimation()
  }

  stop(): void {
    this.generation += 1
    this.abortController?.abort()
    this.abortController = null
    this.clearAnimationTimer()
    this.request = null
    this.currentImage = null
    this.decodedCache.clear()
    this.frameCache.clear()
    this.disposeDecoder?.()
    this.setState(INITIAL_STATE)
  }

  async whenIdle(): Promise<void> {
    await this.work
  }

  private async loadAndRender(
    request: ArtworkRequest & { url: string },
    generation: number,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      let image = this.decodedCache.get(request.url)
      if (image === undefined) {
        const source = await this.fetchBytes(request.url, signal)
        image = await this.decode(
          source.bytes,
          source.mimeType,
          signal,
        )
        if (!this.isCurrent(generation)) {
          return
        }
        this.decodedCache.set(request.url, image)
      }
      if (!this.isCurrent(generation)) {
        return
      }
      this.currentImage = image
      const staticFrame = await this.rasterizeStatic(image, {
        height: request.height,
        width: request.width,
        yieldEveryRows: 2,
      })
      if (!this.isCurrent(generation)) {
        return
      }
      this.setState({
        ...this.state,
        staticFrame,
      })
      await this.renderCurrentFrame(generation)
    } catch (error) {
      if (isAbortError(error) || !this.isCurrent(generation)) {
        return
      }
      this.setState({
        frame: null,
        message:
          error instanceof Error
            ? error.message
            : "Album artwork could not be rendered.",
        rotating: false,
        sourceKey: request.key,
        staticFrame: null,
        status: "error",
      })
    } finally {
      if (
        this.abortController?.signal === signal
      ) {
        this.abortController = null
      }
    }
  }

  private async renderCurrentFrame(
    generation: number,
    cooperative = true,
  ): Promise<void> {
    const request = this.request
    const image = this.currentImage
    if (
      request?.url == null ||
      image === null ||
      !this.isCurrent(generation)
    ) {
      return
    }

    const frameKey = [
      request.url,
      request.width,
      request.height,
      this.rotationFrameIndex,
    ].join(":")
    let frame = this.frameCache.get(frameKey)
    if (frame === undefined) {
      frame = await this.rasterize(image, {
        angleRadians: this.angleRadians,
        height: request.height,
        width: request.width,
        yieldEveryRows: cooperative ? 2 : request.height,
      })
      if (!this.isCurrent(generation)) {
        return
      }
      this.frameCache.set(frameKey, frame)
    }

    this.setState({
      frame,
      message: null,
      rotating: this.shouldAnimate(),
      sourceKey: request.key,
      staticFrame: this.state.staticFrame,
      status: "ready",
    })
    this.scheduleAnimation()
  }

  private syncAnimation(): void {
    const rotating = this.shouldAnimate()
    if (!rotating) {
      this.clearAnimationTimer()
    }
    if (this.state.rotating !== rotating) {
      this.setState({ ...this.state, rotating })
    }
    if (rotating) {
      this.scheduleAnimation()
    }
  }

  private scheduleAnimation(): void {
    if (!this.shouldAnimate() || this.timer !== null) {
      return
    }
    const interval =
      (this.request?.height ?? 0) <= 3
        ? ROTATION_INTERVAL_MS * 2
        : ROTATION_INTERVAL_MS
    this.timer = this.setTimer(() => {
      this.timer = null
      if (!this.shouldAnimate()) {
        return
      }
      this.rotationFrameIndex =
        (this.rotationFrameIndex + 1) % ROTATION_FRAME_COUNT
      this.angleRadians =
        this.rotationFrameIndex * ROTATION_STEP_RADIANS
      const generation = this.generation
      this.work = this.renderCurrentFrame(generation, false).catch(
        (error: unknown) => {
          if (!this.isCurrent(generation)) {
            return
          }
          this.clearAnimationTimer()
          this.setState({
            frame: null,
            message:
              error instanceof Error
                ? error.message
                : "Album artwork could not be rendered.",
            rotating: false,
            sourceKey: this.request?.key ?? null,
            staticFrame: this.state.staticFrame,
            status: "error",
          })
        },
      )
    }, interval)
  }

  private clearAnimationTimer(): void {
    if (this.timer !== null) {
      this.clearTimer(this.timer)
      this.timer = null
    }
  }

  private shouldAnimate(): boolean {
    return (
      this.state.status === "ready" &&
      this.request?.isPlaying === true &&
      this.request.animations &&
      this.terminalFocused
    )
  }

  private isCurrent(generation: number): boolean {
    return generation === this.generation
  }

  private setState(state: ArtworkViewState): void {
    this.state = state
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export function createStaticArtworkController(
  state: ArtworkViewState = INITIAL_STATE,
): ArtworkControllerPort {
  return {
    getSnapshot: () => state,
    setArtwork: () => undefined,
    setTerminalFocused: () => undefined,
    stop: () => undefined,
    subscribe: () => () => undefined,
    whenIdle: () => Promise.resolve(),
  }
}

export async function fetchArtworkBytes(
  url: string,
  signal?: AbortSignal,
): Promise<ArtworkBytes> {
  const response = await fetch(url, {
    headers: { Accept: "image/jpeg, image/png" },
    ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok) {
    throw new Error(
      `Artwork request failed with status ${String(response.status)}`,
    )
  }

  const declaredLength = Number(
    response.headers.get("content-length") ?? "0",
  )
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_ARTWORK_BYTES
  ) {
    throw new Error("Artwork image exceeds the safe size limit")
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_ARTWORK_BYTES) {
    throw new Error("Artwork image exceeds the safe size limit")
  }
  return {
    bytes: new Uint8Array(buffer),
    mimeType: response.headers.get("content-type"),
  }
}

function sameSource(
  previous: ArtworkRequest | null,
  next: ArtworkRequest | null,
): boolean {
  return (
    previous?.key === next?.key &&
    previous?.url === next?.url &&
    previous?.width === next?.width &&
    previous?.height === next?.height
  )
}

function artworkFrameBytes(frame: ArtworkFrame): number {
  return (
    frame.characters.byteLength +
    frame.foreground.byteLength +
    frame.background.byteLength +
    frame.mask.byteLength
  )
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  )
}
