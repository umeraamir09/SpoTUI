import { describe, expect, mock, test } from "bun:test"

import {
  DiscoveryController,
  type DiscoveryRemote,
} from "../../src/discovery/discovery-controller"
import type {
  MediaItem,
  Page,
} from "../../src/discovery/types"
import { TEST_MEDIA_ITEM } from "../helpers/discovery"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function page(
  item: MediaItem,
  offset = 0,
): Page<MediaItem> {
  return {
    items: [item],
    limit: 10,
    offset,
    total: 1,
    hasNext: false,
    hasPrevious: offset > 0,
  }
}

function remote(
  overrides: Partial<DiscoveryRemote> = {},
): DiscoveryRemote {
  return {
    searchTracks: () => Promise.resolve(page(TEST_MEDIA_ITEM)),
    getQueue: () =>
      Promise.resolve({ currentlyPlaying: null, items: [] }),
    getSavedTracks: () => Promise.resolve(page(TEST_MEDIA_ITEM)),
    getPlaylists: () =>
      Promise.resolve({
        items: [],
        limit: 20,
        offset: 0,
        total: 0,
        hasNext: false,
        hasPrevious: false,
      }),
    getPlaylistItems: () => Promise.resolve(page(TEST_MEDIA_ITEM)),
    playUris: () => Promise.resolve(),
    playContext: () => Promise.resolve(),
    addToQueue: () => Promise.resolve(),
    saveToLibrary: () => Promise.resolve(),
    addToPlaylist: () => Promise.resolve(),
    ...overrides,
  }
}

describe("Phase 4 discovery controller", () => {
  test("debounces typing and prevents a stale search response from winning", async () => {
    const timers: (() => void)[] = []
    const first = deferred<Page<MediaItem>>()
    const second = deferred<Page<MediaItem>>()
    const searchTracks = mock((query: string) =>
      query === "first" ? first.promise : second.promise,
    )
    const controller = new DiscoveryController({
      remote: remote({ searchTracks }),
      setTimer: (callback) => {
        timers.push(callback)
        return 1 as unknown as ReturnType<typeof setTimeout>
      },
      clearTimer: () => undefined,
    })

    controller.setSearchQuery("first")
    expect(searchTracks).not.toHaveBeenCalled()
    timers.shift()?.()
    expect(searchTracks).toHaveBeenCalledTimes(1)

    controller.setSearchQuery("second")
    timers.shift()?.()
    second.resolve(
      page({ ...TEST_MEDIA_ITEM, title: "Second Result" }),
    )
    await Promise.resolve()
    first.resolve(
      page({ ...TEST_MEDIA_ITEM, title: "Stale Result" }),
    )
    await controller.whenIdle()

    expect(controller.getSnapshot().search.query).toBe("second")
    expect(controller.getSnapshot().search.page.items[0]?.title).toBe(
      "Second Result",
    )
  })

  test("refreshes the authoritative queue after a successful add", async () => {
    const queued = {
      ...TEST_MEDIA_ITEM,
      title: "Authoritative Queue Item",
    }
    const addToQueue = mock(() => Promise.resolve())
    const getQueue = mock(() =>
      Promise.resolve({
        currentlyPlaying: null,
        items: [queued],
      }),
    )
    const controller = new DiscoveryController({
      remote: remote({ addToQueue, getQueue }),
    })

    const succeeded = await controller.queueItem(
      TEST_MEDIA_ITEM,
      "device-one",
    )

    expect(succeeded).toBe(true)
    expect(addToQueue).toHaveBeenCalledWith(
      TEST_MEDIA_ITEM.uri,
      "device-one",
    )
    expect(getQueue).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().queue.snapshot.items).toEqual([
      queued,
    ])
    expect(controller.getSnapshot().notice?.tone).toBe("success")
  })

  test("loads liked tracks and playlists as one library snapshot", async () => {
    const getSavedTracks = mock(() =>
      Promise.resolve(page(TEST_MEDIA_ITEM)),
    )
    const getPlaylists = mock(() =>
      Promise.resolve({
        items: [
          {
            id: "playlist",
            uri: "spotify:playlist:playlist",
            name: "Playlist",
            owner: "Owner",
            totalItems: 1,
            isPublic: false,
            spotifyUrl: null,
          },
        ],
        limit: 20,
        offset: 0,
        total: 1,
        hasNext: false,
        hasPrevious: false,
      }),
    )
    const controller = new DiscoveryController({
      remote: remote({ getSavedTracks, getPlaylists }),
    })

    await controller.refreshLibrary()

    expect(controller.getSnapshot().library.status).toBe("ready")
    expect(
      controller.getSnapshot().library.snapshot.likedTracks.items,
    ).toHaveLength(1)
    expect(
      controller.getSnapshot().library.snapshot.playlists.items,
    ).toHaveLength(1)
  })
})
