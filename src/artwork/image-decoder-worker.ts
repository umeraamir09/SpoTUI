import { decodeImageBytes } from "./image-codecs"

interface DecodeRequest {
  id: number
  bytes: ArrayBuffer
  mimeType: string | null
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<DecodeRequest>) => void) | null
  postMessage: (message: unknown, transfer?: Transferable[]) => void
}

const workerScope = globalThis as unknown as WorkerScope

workerScope.onmessage = (event) => {
  try {
    const image = decodeImageBytes(
      new Uint8Array(event.data.bytes),
      event.data.mimeType,
    )
    const pixels = image.data.buffer
    workerScope.postMessage(
      {
        id: event.data.id,
        ok: true,
        width: image.width,
        height: image.height,
        pixels,
      },
      [pixels],
    )
  } catch (error) {
    workerScope.postMessage({
      id: event.data.id,
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Artwork decoding failed",
    })
  }
}
