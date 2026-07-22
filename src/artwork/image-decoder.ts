import { decodeImageBytes } from "./image-codecs"
import type { DecodedImage } from "./types"

interface DecodeSuccess {
  id: number
  ok: true
  width: number
  height: number
  pixels: ArrayBuffer
}

interface DecodeFailure {
  id: number
  ok: false
  message: string
}

type DecodeResponse = DecodeSuccess | DecodeFailure

export interface ImageDecoder {
  decode: (
    bytes: Uint8Array,
    mimeType: string | null,
    signal?: AbortSignal,
  ) => Promise<DecodedImage>
}

export class WorkerImageDecoder implements ImageDecoder {
  private worker: Worker | null = null
  private nextRequestId = 0
  private readonly pending = new Map<
    number,
    {
      reject: (error: unknown) => void
      resolve: (image: DecodedImage) => void
      removeAbortListener: () => void
    }
  >()

  decode(
    bytes: Uint8Array,
    mimeType: string | null,
    signal?: AbortSignal,
  ): Promise<DecodedImage> {
    if (signal?.aborted === true) {
      return Promise.reject(createAbortError())
    }

    const worker = this.getWorker()
    this.nextRequestId += 1
    const requestId = this.nextRequestId

    return new Promise<DecodedImage>((resolve, reject) => {
      const onAbort = () => {
        if (!this.pending.has(requestId)) {
          return
        }
        // The codecs are synchronous once running. Replacing the shared
        // worker is the only way to stop obsolete decode CPU immediately.
        this.resetWorker(createAbortError())
      }
      signal?.addEventListener("abort", onAbort, { once: true })
      this.pending.set(requestId, {
        reject,
        resolve,
        removeAbortListener: () => {
          signal?.removeEventListener("abort", onAbort)
        },
      })

      // Buffer#slice is a view, unlike Uint8Array#slice. Copy explicitly so
      // transferring the request never detaches caller-owned memory.
      const transferableBytes = Uint8Array.from(bytes).buffer
      worker.postMessage(
        { id: requestId, bytes: transferableBytes, mimeType },
        [transferableBytes],
      )
    })
  }

  dispose(): void {
    this.resetWorker(new Error("Artwork decoder stopped"))
  }

  private getWorker(): Worker {
    if (this.worker !== null) {
      return this.worker
    }
    const worker = new Worker(
      new URL("./image-decoder-worker.ts", import.meta.url),
      { type: "module" },
    )
    const backgroundWorker = worker as Worker & { unref?: () => void }
    backgroundWorker.unref?.()
    worker.onmessage = (event: MessageEvent<DecodeResponse>) => {
      const pending = this.pending.get(event.data.id)
      if (pending === undefined) {
        return
      }
      this.pending.delete(event.data.id)
      pending.removeAbortListener()
      if (!event.data.ok) {
        pending.reject(new Error(event.data.message))
        return
      }
      pending.resolve({
        data: new Uint8ClampedArray(event.data.pixels),
        height: event.data.height,
        width: event.data.width,
      })
    }
    worker.onerror = (event) => {
      this.resetWorker(
        new Error(
          event.message.length > 0
            ? event.message
            : "Artwork decoder worker failed",
        ),
      )
    }
    this.worker = worker
    return worker
  }

  private resetWorker(error: unknown): void {
    const worker = this.worker
    this.worker = null
    if (worker !== null) {
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }
    for (const pending of this.pending.values()) {
      pending.removeAbortListener()
      pending.reject(error)
    }
    this.pending.clear()
  }
}

export class SyncImageDecoder implements ImageDecoder {
  decode(
    bytes: Uint8Array,
    mimeType: string | null,
    signal?: AbortSignal,
  ): Promise<DecodedImage> {
    if (signal?.aborted === true) {
      return Promise.reject(createAbortError())
    }
    try {
      return Promise.resolve(decodeImageBytes(bytes, mimeType))
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }

  dispose(): void {
    // no-op
  }
}

function createAbortError(): DOMException {
  return new DOMException("Artwork operation aborted", "AbortError")
}
