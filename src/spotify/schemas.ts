import { z } from "zod"

import type {
  PlaybackDevice,
  PlaybackItem,
  PlaybackSnapshot,
} from "../playback/types"
import type {
  MediaItem,
  Page,
  PlaylistSummary,
  QueueSnapshot,
} from "../discovery/types"

export const currentUserProfileSchema = z
  .object({
    account_id: z.string().min(1),
    display_name: z.string().nullable().optional(),
    id: z.string().optional(),
    type: z.string(),
    uri: z.string(),
  })
  .transform((profile) => ({
    accountId: profile.account_id,
    displayName: profile.display_name ?? null,
    spotifyUserId: profile.id ?? null,
    type: profile.type,
    uri: profile.uri,
  }))

export type CurrentUserProfile = z.infer<
  typeof currentUserProfileSchema
>

const imageSchema = z.object({
  url: z.url(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
})

export const playbackDeviceSchema = z
  .object({
    id: z.string().nullable(),
    is_active: z.boolean(),
    is_private_session: z.boolean(),
    is_restricted: z.boolean(),
    name: z.string(),
    type: z.string(),
    volume_percent: z.number().int().min(0).max(100).nullable(),
    supports_volume: z.boolean(),
  })
  .transform(
    (device): PlaybackDevice => ({
      id: device.id,
      isActive: device.is_active,
      isPrivateSession: device.is_private_session,
      isRestricted: device.is_restricted,
      name: device.name,
      type: device.type,
      volumePercent: device.volume_percent,
      supportsVolume: device.supports_volume,
    }),
  )

const trackSchema = z
  .object({
    type: z.literal("track"),
    id: z.string().nullable(),
    uri: z.string().nullable(),
    name: z.string(),
    duration_ms: z.number().int().nonnegative(),
    is_local: z.boolean().default(false),
    artists: z.array(z.object({ name: z.string() })),
    album: z.object({
      name: z.string(),
      images: z.array(imageSchema),
    }),
  })
  .transform(
    (track): PlaybackItem => ({
      kind: "track",
      id: track.id,
      uri: track.uri,
      title: track.name,
      artists: track.artists.map((artist) => artist.name),
      album: track.album.name,
      durationMs: track.duration_ms,
      imageUrl: selectLargestImage(track.album.images),
      isLocal: track.is_local,
    }),
  )

const episodeSchema = z
  .object({
    type: z.literal("episode"),
    id: z.string().nullable(),
    uri: z.string().nullable(),
    name: z.string(),
    duration_ms: z.number().int().nonnegative(),
    images: z.array(imageSchema).default([]),
    show: z.object({
      name: z.string(),
      images: z.array(imageSchema).default([]),
    }),
  })
  .transform(
    (episode): PlaybackItem => ({
      kind: "episode",
      id: episode.id,
      uri: episode.uri,
      title: episode.name,
      artists: [episode.show.name],
      album: episode.show.name,
      durationMs: episode.duration_ms,
      imageUrl: selectLargestImage(
        episode.images.length > 0
          ? episode.images
          : episode.show.images,
      ),
      isLocal: false,
    }),
  )

export const playbackStateSchema = z
  .object({
    device: playbackDeviceSchema,
    repeat_state: z.enum(["off", "context", "track"]),
    shuffle_state: z.boolean(),
    timestamp: z.number().int().nonnegative(),
    progress_ms: z.number().int().nonnegative().nullable(),
    is_playing: z.boolean(),
    item: z.union([trackSchema, episodeSchema]).nullable(),
  })
  .transform(
    (playback): PlaybackSnapshot => ({
      device: playback.device,
      repeatState: playback.repeat_state,
      shuffleState: playback.shuffle_state,
      timestamp: playback.timestamp,
      progressMs: playback.progress_ms ?? 0,
      isPlaying: playback.is_playing,
      item: playback.item,
    }),
  )

export const devicesResponseSchema = z
  .object({
    devices: z.array(playbackDeviceSchema),
  })
  .transform((response) => response.devices)

const externalUrlsSchema = z
  .object({
    spotify: z.url().optional(),
  })
  .optional()

export const mediaTrackSchema = z
  .object({
    type: z.literal("track"),
    id: z.string().nullable(),
    uri: z.string().nullable(),
    name: z.string(),
    duration_ms: z.number().int().nonnegative(),
    explicit: z.boolean().default(false),
    is_local: z.boolean().default(false),
    is_playable: z.boolean().optional(),
    external_urls: externalUrlsSchema,
    artists: z.array(z.object({ name: z.string() })),
    album: z.object({
      name: z.string(),
    }),
  })
  .transform(
    (track): MediaItem => ({
      kind: "track",
      id: track.id,
      uri: track.uri,
      title: track.name,
      artists: track.artists.map((artist) => artist.name),
      album: track.album.name,
      durationMs: track.duration_ms,
      explicit: track.explicit,
      isLocal: track.is_local,
      isPlayable: track.is_playable ?? true,
      spotifyUrl: track.external_urls?.spotify ?? null,
    }),
  )

export const mediaEpisodeSchema = z
  .object({
    type: z.literal("episode"),
    id: z.string().nullable(),
    uri: z.string().nullable(),
    name: z.string(),
    duration_ms: z.number().int().nonnegative(),
    explicit: z.boolean().default(false),
    is_playable: z.boolean().optional(),
    external_urls: externalUrlsSchema,
    show: z.object({ name: z.string() }),
  })
  .transform(
    (episode): MediaItem => ({
      kind: "episode",
      id: episode.id,
      uri: episode.uri,
      title: episode.name,
      artists: [episode.show.name],
      album: episode.show.name,
      durationMs: episode.duration_ms,
      explicit: episode.explicit,
      isLocal: false,
      isPlayable: episode.is_playable ?? true,
      spotifyUrl: episode.external_urls?.spotify ?? null,
    }),
  )

const mediaItemSchema = z.union([
  mediaTrackSchema,
  mediaEpisodeSchema,
])

const pageMetadataSchema = z.object({
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
})

export const searchTracksResponseSchema = z
  .object({
    tracks: pageMetadataSchema.extend({
      items: z.array(mediaTrackSchema),
    }),
  })
  .transform(
    ({ tracks }): Page<MediaItem> => ({
      items: tracks.items,
      limit: tracks.limit,
      offset: tracks.offset,
      total: tracks.total,
      hasNext: tracks.next !== null,
      hasPrevious: tracks.previous !== null,
    }),
  )

export const queueResponseSchema = z
  .object({
    currently_playing: mediaItemSchema.nullable(),
    queue: z.array(mediaItemSchema),
  })
  .transform(
    (queue): QueueSnapshot => ({
      currentlyPlaying: queue.currently_playing,
      items: queue.queue,
    }),
  )

const savedTracksPageSchema = pageMetadataSchema.extend({
  items: z.array(
    z.object({
      added_at: z.string().optional(),
      track: mediaTrackSchema,
    }),
  ),
})

export const savedTracksResponseSchema = savedTracksPageSchema.transform(
  (page): Page<MediaItem> => ({
    items: page.items.map((item) => item.track),
    limit: page.limit,
    offset: page.offset,
    total: page.total,
    hasNext: page.next !== null,
    hasPrevious: page.previous !== null,
  }),
)

const playlistSummarySchema = z
  .object({
    id: z.string().min(1),
    uri: z.string().min(1),
    name: z.string(),
    public: z.boolean().nullable(),
    external_urls: externalUrlsSchema,
    owner: z.object({
      display_name: z.string().nullable().optional(),
      id: z.string(),
    }),
    items: z.object({
      total: z.number().int().nonnegative(),
    }),
  })
  .transform(
    (playlist): PlaylistSummary => ({
      id: playlist.id,
      uri: playlist.uri,
      name: playlist.name,
      owner: playlist.owner.display_name ?? playlist.owner.id,
      totalItems: playlist.items.total,
      isPublic: playlist.public,
      spotifyUrl: playlist.external_urls?.spotify ?? null,
    }),
  )

export const playlistsResponseSchema = pageMetadataSchema
  .extend({
    items: z.array(playlistSummarySchema),
  })
  .transform(
    (page): Page<PlaylistSummary> => ({
      items: page.items,
      limit: page.limit,
      offset: page.offset,
      total: page.total,
      hasNext: page.next !== null,
      hasPrevious: page.previous !== null,
    }),
  )

export const playlistItemsResponseSchema = pageMetadataSchema
  .extend({
    items: z.array(
      z.object({
        item: mediaItemSchema.nullable(),
      }),
    ),
  })
  .transform(
    (page): Page<MediaItem> => ({
      items: page.items.flatMap(({ item }) =>
        item === null ? [] : [item],
      ),
      limit: page.limit,
      offset: page.offset,
      total: page.total,
      hasNext: page.next !== null,
      hasPrevious: page.previous !== null,
    }),
  )

function selectLargestImage(
  images: readonly z.infer<typeof imageSchema>[],
): string | null {
  const sorted = [...images].sort(
    (left, right) =>
      (right.width ?? 0) * (right.height ?? 0) -
      (left.width ?? 0) * (left.height ?? 0),
  )
  return sorted[0]?.url ?? null
}
