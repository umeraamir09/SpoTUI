import {
  createStaticDiscoveryController,
  type DiscoveryViewState,
} from "../../src/discovery/discovery-controller"
import type {
  MediaItem,
  PlaylistSummary,
} from "../../src/discovery/types"

export const TEST_MEDIA_ITEM: MediaItem = {
  kind: "track",
  id: "track-search",
  uri: "spotify:track:search",
  title: "Catalog Receiver",
  artists: ["Search Unit"],
  album: "Signals Found",
  durationMs: 201_000,
  explicit: false,
  isLocal: false,
  isPlayable: true,
  spotifyUrl: "https://open.spotify.com/track/search",
}

export const TEST_PLAYLIST: PlaylistSummary = {
  id: "playlist-one",
  uri: "spotify:playlist:one",
  name: "Late Night Signals",
  owner: "Umroo",
  totalItems: 12,
  isPublic: false,
  spotifyUrl: "https://open.spotify.com/playlist/one",
}

const mediaPage = {
  items: [TEST_MEDIA_ITEM],
  limit: 10,
  offset: 0,
  total: 1,
  hasNext: false,
  hasPrevious: false,
}

export const TEST_DISCOVERY_STATE: DiscoveryViewState = {
  search: {
    query: "catalog",
    status: "ready",
    page: mediaPage,
    recentQueries: ["catalog"],
    error: null,
  },
  queue: {
    status: "ready",
    snapshot: {
      currentlyPlaying: TEST_MEDIA_ITEM,
      items: [
        {
          ...TEST_MEDIA_ITEM,
          id: "queued-track",
          uri: "spotify:track:queued",
          title: "Queued Transmission",
        },
      ],
    },
    error: null,
  },
  library: {
    status: "ready",
    snapshot: {
      likedTracks: mediaPage,
      playlists: {
        items: [TEST_PLAYLIST],
        limit: 20,
        offset: 0,
        total: 1,
        hasNext: false,
        hasPrevious: false,
      },
    },
    activePlaylist: null,
    playlistItems: {
      ...mediaPage,
      limit: 20,
    },
    playlistStatus: "idle",
    error: null,
  },
  notice: null,
}

export function createDiscoveryController(
  state: DiscoveryViewState = TEST_DISCOVERY_STATE,
) {
  return createStaticDiscoveryController(state)
}
