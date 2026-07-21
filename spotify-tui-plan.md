# Retro Spotify TUI — Product and Implementation Plan

> Working title only: **UmrooFM**. The name is not locked.
>
> This document is intended to be handed directly to Codex. It defines the product, technical architecture, UI behavior, implementation phases, and acceptance criteria.

## 1. Product vision

Build a polished terminal music controller with a cozy retro-computing and pixel-art personality. It should feel like a small music appliance living inside the terminal rather than a web application squeezed into text cells.

The app controls playback on the user's existing Spotify clients and Spotify Connect devices. It does **not** stream or decode Spotify audio itself.

The rough sketch supplied by the user communicates only the broad two-column layout:

- Left: a large vinyl/album-art presentation.
- Right: lyrics or another information panel, track metadata, playback controls, volume, and progress.

Do **not** copy the sketch's visual styling. The final design must be independently designed around a warm retro terminal aesthetic.

## 2. Locked decisions

- TUI framework: **OpenTUI**.
- Language: **TypeScript**.
- Runtime/build tool: **Bun**.
- UI binding: **OpenTUI React**.
- Authentication: Spotify Authorization Code with PKCE.
- Initial distribution model: **bring your own Spotify Client ID**.
- Playback model: remote-control an active Spotify client/device through Spotify Web API.
- MVP search target: tracks.
- Lyrics: provider abstraction with LRCLIB as the first optional provider and local `.lrc` override support.
- No backend service is required.
- No analytics or telemetry by default.

## 3. Important feasibility constraints

### 3.1 Spotify Premium is effectively required

Spotify's playback-control endpoints—play, pause, seek, skip, volume, shuffle, repeat, queue, and device transfer—work only for Premium users. The app must detect a 403 and show a clear in-app explanation instead of failing silently.

As of Spotify's 2026 Development Mode changes, the developer who owns a Development Mode app must also have Premium. A Development Mode Client ID is limited to five authorized users. For an open-source personal tool, the cleanest path is to ask each user to supply their own Client ID rather than shipping one shared Development Mode application.

### 3.2 This is a controller, not a terminal audio player

The TUI should control Spotify running on desktop, mobile, browser, smart speaker, or another Connect device. When there is no active device, show a device picker and instructions to open Spotify somewhere. Do not attempt to obtain, download, or decode Spotify audio.

### 3.3 Spotify has no public Web API lyrics endpoint

Lyrics must be treated as optional external data. Implement a provider interface so the app is not tightly coupled to one lyrics service. The first provider may use LRCLIB for synced and plain lyrics. Also support a local `.lrc` file override for users who prefer local data.

For public distribution, review the lyrics provider's terms and the rights implications before advertising lyrics as guaranteed functionality.

### 3.4 Album artwork is part of the creative presentation

Treat the current track artwork as raw visual material for the retro player rather than as a locked square image. The primary presentation is explicitly defined as follows:

- crop and circularly mask the artwork so it fills the **entire visible vinyl face**, edge to edge,
- do not reduce the artwork to a small center label,
- render one subtle center dot as a deliberate focal detail, but do not render a spindle, spindle hole, center pin, or separate center-label disc,
- rotate the full-face artwork while playback is active,
- resize, dither, posterize, recolor, or otherwise stylize it for the terminal,
- keep the full-face artwork clean without a procedural groove texture,
- add restrained highlights, shadows, scanlines, and pixel effects without obscuring the cover,
- allow theme variations only when they preserve this full-face artwork concept.

The album cover itself must therefore become the complete circular record surface. A subtle center dot is required, while procedural groove textures, a spindle, spindle hole, center pin, and separate label disc remain explicitly excluded. Keep an `Open in Spotify` action in the information panel as a useful navigation feature, not as a visual constraint.

## 4. Experience goals

1. **Instantly understandable** — common playback actions should be discoverable without reading documentation.
2. **Keyboard-first** — every action has a direct keybinding; mouse support is optional.
3. **Cozy, not noisy** — restrained animation, warm colors, tactile borders, and subtle pixel details.
4. **Useful when lyrics are unavailable** — the top-right area should always contain meaningful information.
5. **Responsive** — remain usable from a small split terminal to a large fullscreen terminal.
6. **Reliable under API uncertainty** — handle no device, restricted device, expired token, local track, podcast, unavailable artwork, rate limits, and network loss.

## 5. Visual direction

### 5.1 Aesthetic

Use an original visual language inspired by:

- late-1980s/early-1990s music hardware displays,
- warm phosphor terminals,
- pixel-art record players,
- cassette-deck labels,
- restrained CRT status indicators.

Avoid imitating Spotify's application UI. Spotify branding should appear only where required for attribution.

Suggested default palette:

- Background: near-black brown `#0B0A08`
- Primary text: warm cream `#E8DCC8`
- Secondary text: muted taupe `#8F8577`
- Accent: amber `#D4A24C`
- Secondary accent: muted sage `#789174`
- Error: dusty red `#B45D5D`
- Spotify attribution accent: official Spotify green where appropriate

Provide 256-color fallbacks and a monochrome mode.

### 5.2 Typography and glyphs

- Use OpenTUI's small ASCII font only for compact headings or the startup wordmark.
- Prefer ordinary readable terminal text for metadata and lyrics.
- Use Unicode box-drawing and block characters when supported.
- Provide an ASCII-only fallback for terminals with poor glyph coverage.

### 5.3 Motion

- Make the vinyl animation visually expressive while keeping input and rendering responsive.
- Rotate the circularly masked, full-face album artwork together with a subtle center dot and restrained highlights; do not overlay groove textures, and never render a spindle, spindle hole, center pin, or separate center label.
- Use stepped, low-frame-rate motion to reinforce the intentional pixel-art character rather than chasing smooth video-like animation.
- Pause the record when playback is paused.
- Stop or heavily reduce animation when the terminal loses focus.
- Add `--no-animations` and config option `ui.animations = false`.
- Target roughly 8–12 visual updates per second by default, with an adaptive lower rate for slower terminals.

## 6. Responsive layout

### 6.1 Large layout — 110+ columns, 30+ rows

Two-column layout:

- Left column: 42–48% width.
  - Vinyl presentation.
  - Small album name and context line underneath.
- Right column: remaining width.
  - Top information panel with tabs.
  - Track title and artist.
  - Playback controls.
  - Progress bar and timestamps.
  - Volume and playback-mode indicators.
- Bottom status strip:
  - current device,
  - connection state,
  - Spotify attribution/open action,
  - compact hotkey hints.

Conceptual structure:

```text
┌──────────────────────────────┬─────────────────────────────────────────────┐
│                              │  [QUEUE] [LYRICS] [INFO] [DEVICE]           │
│       animated vinyl         │ ┌─────────────────────────────────────────┐ │
│   + rotating album artwork   │ │ context-sensitive top panel             │ │
│                              │ │                                         │ │
│                              │ └─────────────────────────────────────────┘ │
│      album / context         │  TRACK TITLE                               │
│                              │  Artist • Album                            │
│                              │  shuffle  prev  play  next  repeat         │
│                              │  01:12  ━━━━━━━━━━━━━━━╺━━━━  03:58         │
│                              │  volume  [━━━━━━━━━━╺━━]  72%               │
├──────────────────────────────┴─────────────────────────────────────────────┤
│ device: Desktop  • connected  • open in Spotify  • ? help  • / search    │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Medium layout — 76–109 columns

- Keep two columns when possible.
- Reduce vinyl size.
- Collapse controls to glyphs plus focused labels.
- Show only the active top panel, not all tab labels.
- Hide nonessential album/context details.

### 6.3 Compact layout — under 76 columns or under 24 rows

Stack vertically:

- small artwork/vinyl strip,
- title and artist,
- progress,
- controls,
- active panel below in a scrollbox.

At very small sizes, replace album art with a small procedural record icon and preserve metadata/control usability.

### 6.4 Minimum supported size

- Hard minimum: 52 columns × 16 rows.
- Below this, render a centered message explaining the required size and continue listening/control polling in the background.

## 7. Top-right panel ideas

The app must not leave the top-right region empty when lyrics are hidden or unavailable.

### Recommended default: `QUEUE`

Show:

- currently playing track,
- next 3–6 queued tracks,
- source context such as playlist/album when available,
- a compact marker for explicit/local/unavailable items.

This is the most useful default because it supports the core music-controller workflow.

### Additional panels

1. **LYRICS**
   - Synced line highlighting when timed lyrics exist.
   - Plain scrollable lyrics otherwise.
   - Clear `Lyrics unavailable` state.
   - Provider/source label in the panel footer.

2. **INFO / LINER NOTES**
   - Album title.
   - Release date/year.
   - Track number and disc number.
   - Duration.
   - Explicit marker.
   - Current playback context.
   - Spotify URI shortened for display.

3. **DEVICE / SIGNAL PATH**
   - Active device name and type.
   - Volume support.
   - Restricted/private-session state.
   - Other available devices.
   - Transfer playback action.

4. **HISTORY**
   - Recently played tracks if the optional scope is enabled.
   - Keep this off by default unless the user grants `user-read-recently-played`.

5. **KEYS / COMMAND DECK**
   - Context-sensitive hotkeys.
   - Useful for first-run onboarding and as a fallback panel.

6. **AMBIENT DECK**
   - Decorative non-audio-reactive pixel motion, session clock, and compact track facts.
   - Must not claim to be an audio waveform or spectrum analyzer.

Panel order for MVP: `QUEUE`, `LYRICS`, `INFO`, `DEVICE`.

## 8. Navigation and keybindings

### 8.1 Global bindings

| Key | Action |
|---|---|
| `Space` | Play/pause |
| `n` | Next track |
| `p` | Previous track |
| `h` / `Left` | Seek backward 5 seconds |
| `l` / `Right` | Seek forward 5 seconds |
| `H` | Seek backward 30 seconds |
| `L` | Seek forward 30 seconds |
| `+` / `=` | Volume +5% |
| `-` | Volume -5% |
| `m` | Mute/unmute using remembered previous volume |
| `s` | Toggle shuffle |
| `r` | Cycle repeat: off → context → track |
| `/` | Open search overlay |
| `u` | Open queue panel |
| `y` | Toggle lyrics panel |
| `i` | Open info panel |
| `d` | Open device panel |
| `Tab` / `Shift+Tab` | Move focus forward/backward |
| `o` | Open current track in Spotify |
| `?` | Help/command deck |
| `q` | Quit when no modal/input is focused |
| `Esc` | Close modal or return to player |

### 8.2 Search bindings

- Type naturally in the input.
- `Up` / `Down` or `j` / `k`: move selection.
- `Enter`: play selected track now.
- `a`: add selected track to queue.
- `o`: open selected result in Spotify.
- `Esc`: close search.
- `PageUp` / `PageDown`: paginate if more results are requested.

Do not let global playback shortcuts fire while the search input is consuming text.

### 8.3 Device picker bindings

- `Up` / `Down`: select device.
- `Enter`: transfer playback.
- `Shift+Enter`: transfer and force playback.
- Restricted devices remain visible but disabled with an explanation.

## 9. Search experience

1. Press `/` to open a centered overlay.
2. Focus the search input immediately.
3. Start searching after 250–350 ms of inactivity.
4. Cancel the previous request with `AbortController` when input changes.
5. Request `type=track`, `limit=10`.
6. Render title, artist, album, duration, and explicit marker.
7. Keep a small recent-query history locally.
8. On `Enter`, start playback with the selected track URI.
9. If no active device exists, route the user to device selection before retrying playback.
10. On `a`, add the URI to the playback queue and show a short toast.

## 10. Playback-state strategy

### 10.1 Authoritative polling

Use `GET /me/player` as the authoritative source.

Suggested cadence:

- Playing and terminal focused: every 3 seconds.
- Playing and terminal blurred: every 8 seconds.
- Paused: every 8–10 seconds.
- No active playback/device: every 15 seconds.
- Immediately after a playback command: optimistic update, then authoritative refresh after roughly 300–500 ms.

### 10.2 Local progress interpolation

Between polls:

- Store the server-reported `progress_ms`, `timestamp`, and local receipt time.
- If `is_playing`, derive the visible progress locally.
- Clamp to duration.
- Correct smoothly when the next server poll arrives.

This keeps the progress bar fluid without calling Spotify several times per second.

### 10.3 Error and rate-limit handling

- `401`: attempt one refresh-token exchange, then retry once.
- `403`: classify Premium, scope, policy, or restricted-device failure where possible.
- `404`: no active device or unavailable resource.
- `429`: honor `Retry-After`; do not tight-loop.
- Network error: retain last known state, mark it stale, and back off.
- `204` from playback state: render `Nothing playing` rather than treating it as malformed JSON.

## 11. Spotify authorization

### 11.1 User onboarding

On first launch:

1. Explain that the user needs a Spotify Premium account and a Spotify Developer app.
2. Ask for a Spotify Client ID, or read it from `SPOTIFY_CLIENT_ID`.
3. Explain the redirect URI to register.
4. Start a loopback callback server on `127.0.0.1` with a dynamic port.
5. Generate PKCE verifier/challenge and random `state`.
6. Open the system browser to Spotify authorization.
7. Validate `state` on callback.
8. Exchange authorization code for access and refresh tokens.
9. Store the refresh token securely.
10. Close the browser callback page with a minimal success message and return focus to the TUI.

Use an explicit loopback IP. Do not use `localhost`.

### 11.2 Required MVP scopes

- `user-read-playback-state`
- `user-read-currently-playing`
- `user-modify-playback-state`
- `user-read-private` for current profile/search compatibility

Optional later scopes:

- `user-read-recently-played`
- `user-library-read`
- `user-library-modify`
- `playlist-read-private`

Request optional scopes only when the corresponding feature is enabled.

### 11.3 Token storage

Preferred:

- Use `Bun.secrets` with service name such as `dev.umroo.vinylcli`.
- Store refresh token and account identifier in the OS credential store.

Because `Bun.secrets` is currently marked experimental, isolate it behind a `SecretStore` interface.

Fallback:

- Only when the user explicitly enables it, store tokens in a private config file with restrictive permissions.
- Never print tokens to logs.
- Redact Authorization headers in debug output.

## 12. Spotify API surface

Implement a typed wrapper around these endpoints:

### Read

- `GET /me`
- `GET /me/player`
- `GET /me/player/currently-playing` only if a narrower request is useful
- `GET /me/player/devices`
- `GET /me/player/queue`
- `GET /search?q=...&type=track&limit=10`

### Write

- `PUT /me/player/play`
- `PUT /me/player/pause`
- `POST /me/player/next`
- `POST /me/player/previous`
- `PUT /me/player/seek?position_ms=...`
- `PUT /me/player/volume?volume_percent=...`
- `PUT /me/player/shuffle?state=...`
- `PUT /me/player/repeat?state=off|context|track`
- `PUT /me/player` for device transfer
- `POST /me/player/queue?uri=...`

The client must:

- use a single request helper,
- inject the access token,
- refresh once on 401,
- parse error payloads safely,
- honor 429 `Retry-After`,
- validate critical responses,
- support cancellation for search and nonessential panel requests.

Do not rely on removed/deprecated endpoints from pre-2026 examples.

## 13. Lyrics subsystem

Define:

```ts
interface LyricsProvider {
  id: string
  getLyrics(track: LyricsTrackIdentity, signal?: AbortSignal): Promise<LyricsResult | null>
}
```

`LyricsTrackIdentity` should include:

- track title,
- primary artist,
- album name,
- duration in seconds,
- Spotify track ID when available.

`LyricsResult`:

```ts
type LyricsResult =
  | { kind: "synced"; lines: Array<{ atMs: number; text: string }>; source: string }
  | { kind: "plain"; text: string; source: string }
```

Provider order:

1. local `.lrc` override/cache,
2. LRCLIB,
3. unavailable state.

Behavior:

- Fetch on track change only when lyrics panel is active, or prefetch after core playback data is stable.
- Cache by normalized artist/title/album/duration key.
- Highlight current synced line using locally interpolated progress.
- Keep the active line near the vertical center.
- Allow manual scrolling; resume auto-follow after a short idle timeout or a dedicated key.
- Do not scrape Spotify's private lyrics endpoints.

## 14. Artwork and vinyl rendering

### 14.1 Artwork pipeline

1. Select a suitable Spotify-provided image URL.
2. Fetch and cache it in memory and optionally on disk.
3. Decode JPEG/PNG asynchronously.
4. Generate a square working texture using configurable `cover`, `contain`, or focal crop behavior.
5. Apply the active visual treatment: circular mask, dithering, palette reduction, scanlines, pixelation, posterization, tinting, or other theme effects.
6. Convert the result into true-color half-block characters (`▀`/`▄`), terminal graphics when supported, or an equivalent custom framebuffer representation.
7. Produce reusable rotation frames or rotate the sampled texture at render time, depending on measured performance.
8. Provide 256-color, monochrome, ASCII, and no-art fallbacks.

Artwork processing must run in a worker or asynchronous task so track changes never freeze keyboard input.

### 14.2 Spinning vinyl presentation

- Use the album artwork as the **entire circular vinyl face**, filling the record from edge to edge after circular masking.
- Never present the artwork merely as a center label.
- Render a subtle center dot, but never render a spindle, spindle hole, center pin, or separate label ring.
- Rotate the full-face artwork while playback is active.
- Do not overlay concentric groove textures across the circular artwork.
- Add restrained pixel highlights, edge shading, subtle wobble, and stepped frame animation where they improve the cozy retro effect.
- The normal artwork modes may vary in dithering, palette, scanlines, and highlight treatment, but all must retain the full-disc artwork design.
- A minimal ASCII record is permitted only as a fallback when artwork is unavailable, art rendering is disabled, or the terminal cannot support the normal renderer.
- Use playback state to start and stop the animation.
- Lower animation resolution or frame rate automatically on constrained terminals.
- Keep the progress bar and transport controls independent from animation timing.

### 14.3 Cache

- Memory LRU for decoded artwork, transformed textures, and rotation frames.
- Small disk cache with a configurable upper size limit.
- Cache metadata should include source URL, transformation preset, dimensions, and timestamp.
- Invalidate derived frames when the theme, crop mode, or render dimensions change.

## 15. Application architecture

### 15.1 Packages

Core dependencies:

- `@opentui/core`
- `@opentui/react`
- `@opentui/keymap`
- `react`
- `zod` or an equivalent lightweight runtime validator

Prefer platform/runtime APIs before adding dependencies:

- `fetch`
- `Bun.serve`
- `Bun.secrets`
- `Bun.file`
- `bun:test`

Choose the smallest practical image decoder. Avoid a heavy image stack unless required.

### 15.2 Suggested directory layout

```text
src/
  app/
    App.tsx
    bootstrap.ts
    routes.ts
  auth/
    pkce.ts
    auth-service.ts
    callback-server.ts
    token-manager.ts
    secret-store.ts
  spotify/
    client.ts
    endpoints.ts
    schemas.ts
    errors.ts
    playback-controller.ts
  playback/
    playback-store.ts
    playback-poller.ts
    progress-clock.ts
    selectors.ts
  lyrics/
    types.ts
    lyrics-service.ts
    lrc-parser.ts
    providers/
      local-provider.ts
      lrclib-provider.ts
  artwork/
    artwork-service.ts
    image-decoder.ts
    cell-rasterizer.ts
    artwork-cache.ts
  ui/
    theme/
      palette.ts
      theme.ts
    components/
      PlayerShell.tsx
      VinylDeck.tsx
      AlbumArtwork.tsx
      TrackMetadata.tsx
      TransportControls.tsx
      ProgressBar.tsx
      VolumeControl.tsx
      StatusBar.tsx
      ToastHost.tsx
    panels/
      QueuePanel.tsx
      LyricsPanel.tsx
      InfoPanel.tsx
      DevicePanel.tsx
    overlays/
      SearchOverlay.tsx
      HelpOverlay.tsx
      FirstRunOverlay.tsx
      ErrorOverlay.tsx
  input/
    commands.ts
    keymap.ts
    focus-manager.ts
  config/
    config.ts
    paths.ts
    migrations.ts
  platform/
    open-url.ts
    terminal-capabilities.ts
  shared/
    async.ts
    cache.ts
    format.ts
    logger.ts
    types.ts

scripts/
  build.ts

tests/
  unit/
  integration/
  visual/
```

### 15.3 State boundaries

Use a small external observable store or a focused state container rather than putting every network concern directly in React state.

Store slices:

- authentication,
- playback,
- queue,
- devices,
- lyrics,
- artwork,
- UI mode/focus,
- toasts/errors.

React components should subscribe through selectors to prevent the whole interface rerendering on every progress tick.

### 15.4 Command layer

All user actions should dispatch named commands such as:

- `player.toggle`
- `player.next`
- `player.seekForwardSmall`
- `volume.increase`
- `panel.lyrics`
- `search.open`
- `app.quit`

Keybindings map to commands; UI controls also invoke commands. This keeps behavior consistent and makes keymaps configurable later.

## 16. UI states that must be designed

- First run / Client ID not configured.
- Browser authorization in progress.
- Authorization denied.
- Token expired and refresh failed.
- Spotify Premium requirement not met.
- No active Spotify device.
- Available devices but none active.
- Restricted active device.
- Device does not support volume.
- Nothing currently playing.
- Track playing.
- Paused.
- Ad or unknown playback item.
- Local Spotify track with incomplete metadata.
- Podcast/episode playing.
- Artwork loading/unavailable.
- Lyrics loading/unavailable/plain/synced.
- Search idle/loading/empty/error/results.
- Offline with stale last-known data.
- Rate limited with retry countdown.
- Terminal too small.

## 17. Testing strategy

### 17.1 Unit tests

- PKCE verifier/challenge generation.
- OAuth state validation.
- Token refresh serialization so concurrent 401s trigger one refresh.
- API error classification.
- Retry-After parsing.
- Progress interpolation and clamping.
- Repeat-state cycling.
- Volume mute/restore behavior.
- Search debounce/cancellation.
- LRC parsing and active-line selection.
- Lyrics normalization/cache keys.
- Artwork cell rasterization.
- Keymap command routing.

### 17.2 Integration tests

Mock `fetch` and test:

- successful login/token refresh,
- no active device then transfer and play,
- playback command followed by refresh,
- 401 refresh and replay,
- 403 Premium/restricted-device behavior,
- 429 backoff,
- search result selection and queue add,
- track change triggers artwork and lyrics cancellation/reload.

### 17.3 Visual/frame tests

Use OpenTUI's test renderer and capture character frames at:

- 140×40,
- 110×30,
- 90×26,
- 72×22,
- 52×16.

Snapshot:

- normal player,
- lyrics,
- queue,
- search overlay,
- device picker,
- no device,
- offline/stale,
- terminal too small.

Also assert styled spans for important focus and error states, not only plain characters.

### 17.4 Manual acceptance matrix

Test on:

- Windows Terminal / PowerShell,
- macOS Terminal or iTerm2,
- a mainstream Linux terminal,
- true-color terminal,
- 256-color terminal,
- Unicode and ASCII-only modes.

## 18. Performance targets

- Input-to-response latency under 50 ms for local UI actions.
- No blocking image decoding on the main input path.
- Idle CPU near zero when paused and no animation is active.
- Playing-state CPU low enough for long-running terminal use.
- Memory bounded through LRU caches.
- Search request cancellation prevents stale results replacing current results.
- Only progress-related components update on local progress ticks.

## 19. Configuration

Default config path should follow the platform's conventional config directory.

Example:

```toml
[spotify]
client_id = ""

[ui]
theme = "warm-phosphor"
animations = true
unicode = true
album_art = true
panel = "queue"

[controls]
seek_small_seconds = 5
seek_large_seconds = 30
volume_step = 5

[lyrics]
provider = "lrclib"
auto_follow = true

[network]
playing_poll_seconds = 3
paused_poll_seconds = 9
```

Secrets must not be written into this file.

CLI options:

```text
vinylcli
vinylcli auth login
vinylcli auth logout
vinylcli config path
vinylcli doctor
vinylcli --no-animations
vinylcli --ascii
vinylcli --no-art
vinylcli --debug
```

`doctor` should verify:

- terminal capabilities,
- config validity,
- keyring access,
- Spotify Client ID presence,
- callback port binding,
- authentication state,
- basic Spotify API access.

## 20. Packaging and release

Use Bun's standalone compilation and OpenTUI's supported native-package embedding approach.

Initial release targets:

- Windows x64,
- Linux x64 glibc,
- Linux arm64 glibc,
- macOS arm64,
- macOS x64 if practical.

Release contents:

- single executable where supported,
- README with Spotify Developer setup,
- example config,
- license,
- privacy note,
- troubleshooting guide,
- checksums.

GitHub Actions should:

1. install Bun,
2. install dependencies for target platforms,
3. typecheck,
4. lint,
5. run unit/integration/visual tests,
6. compile target binaries,
7. smoke-test `--help` and `doctor --offline`,
8. attach artifacts to a tagged release.

## 21. Implementation phases

### Phase 0 — Repository and OpenTUI foundation

Deliver:

- Bun/TypeScript/OpenTUI React project.
- Strict TypeScript configuration.
- Renderer bootstrap and cleanup.
- Global command/keymap architecture.
- Theme tokens.
- Responsive empty shell.
- Test renderer setup.

Acceptance:

- App opens and exits cleanly.
- Resize works without corruption.
- Snapshot tests run at all target sizes.

### Phase 1 — Authentication and typed Spotify client

Deliver:

- Client ID setup.
- PKCE generation.
- loopback callback server.
- browser open.
- token exchange/refresh.
- secret-store abstraction.
- typed API request helper.
- first-run onboarding and login states.

Acceptance:

- Fresh user can authorize without copying an authorization code manually.
- Refresh survives app restart.
- Invalid/expired tokens recover or produce a clear re-login path.

### Phase 2 — Core playback controller

Deliver:

- playback polling,
- local progress interpolation,
- play/pause,
- next/previous,
- seek,
- volume/mute,
- shuffle/repeat,
- no-device handling,
- device list/transfer.

Acceptance:

- All supported controls reliably affect an active Spotify client.
- Unsupported/restricted actions are visibly disabled or explained.
- Progress remains smooth between polls.

### Phase 3 — Main retro player UI

Deliver:

- large/medium/compact layouts,
- transport controls,
- progress/volume components,
- metadata,
- status bar,
- toast/error system,
- accessibility fallbacks.

Acceptance:

- Interface is useful at every supported size.
- Keyboard focus is always visible.
- No screen corruption after repeated resize/modal use.

### Phase 4 — Search and queue

Deliver:

- search overlay,
- debounced/cancelled requests,
- track results,
- play now,
- add to queue,
- add to liked songs / playlist button
- queue panel.
- Spotify Library View
- Playlists browsing and playing from Library

Acceptance:

- Search remains responsive during typing.
- Stale network responses cannot overwrite current results.
- Queue updates after a successful add.

### Phase 5 — Artwork and vinyl presentation

Deliver:

- artwork fetch/cache/decode,
- circular masking, cropping, and terminal styling pipeline,
- rotating album-art vinyl renderer,
- a restrained highlight layer and subtle center dot, with no groove texture, spindle, spindle hole, center pin, or separate label disc,
- play/pause animation state,
- no-art/ASCII fallbacks.

Acceptance:

- The current album artwork fills the entire circular spinning vinyl face rather than appearing as a center label.
- Cropping, masking, rotation, and theme effects produce stable output without corrupting the terminal.
- No procedural groove texture obscures or alters the full-face artwork.
- A subtle center dot is rendered; no spindle, spindle hole, center pin, or separate label disc is rendered.
- Track changes do not block input.
- Animation stops when paused or disabled.

### Phase 6 — Lyrics and information panels

Deliver:

- provider interface,
- LRCLIB provider,
- local LRC provider,
- synced/plain lyrics rendering,
- auto-follow,
- info panel,
- panel tabs and shortcuts.

Acceptance:

- Lyrics failure never affects playback controls.
- Synced lyrics follow interpolated playback accurately enough for casual use.
- Queue/info remain useful when lyrics are unavailable.

### Phase 7 — Hardening and release

Deliver:

- full error matrix,
- rate-limit/backoff behavior,
- offline/stale state,
- doctor command,
- config migration,
- cross-platform builds,
- release workflow,
- documentation.

Acceptance:

- All automated tests pass.
- Manual platform matrix is completed.
- Fresh-machine setup is documented and reproducible.

## 22. MVP definition

The MVP is complete only when a Premium user can:

1. configure their Spotify Client ID,
2. authorize through the browser,
3. see current track and active device,
4. play/pause, skip, seek, change volume, shuffle, and repeat,
5. search for a track and play or queue it,
6. switch Spotify Connect device,
7. view the queue,
8. view album artwork transformed into a rotating retro vinyl presentation,
9. optionally view lyrics,
10. use the app comfortably at large, medium, and compact terminal sizes,
11. restart the app without logging in again,
12. receive clear feedback for all important failure states.

## 23. Explicit non-goals for MVP

- Playing Spotify audio directly inside the terminal.
- Downloading Spotify tracks for the user.
- Scraping private Spotify endpoints.
- Playlist editing.
- Social/Jam features.
- Recommendation engine.
- Audio-reactive spectrum analysis.
- Plugin marketplace.
- Mobile support.
- Commercial monetization.

## 24. Codex execution rules

Codex should:

- read current OpenTUI and Spotify documentation before relying on remembered APIs,
- use Spotify's current OpenAPI schema for endpoint/response details,
- avoid deprecated pre-2026 Spotify examples,
- implement one phase at a time,
- write tests with every phase,
- keep network, rendering, and domain logic separated,
- never log OAuth tokens,
- never block keyboard input on image or lyrics work,
- preserve terminal cleanup on every error path,
- prefer small composable modules over one large `App.tsx`,
- update this plan only when a discovered platform constraint requires it and document the reason.

## 25. Suggested first Codex prompt

```text
Read spotify-tui-codex-plan.md in full. Implement Phase 0 only.

Use Bun, strict TypeScript, OpenTUI core, OpenTUI React, and OpenTUI keymap. Build the repository foundation, renderer lifecycle, command/keymap architecture, theme tokens, responsive empty player shell, and OpenTUI visual test setup.

Do not implement Spotify authentication, API calls, artwork fetching, or lyrics yet. Create interfaces/placeholders only where Phase 0 needs stable boundaries for later phases.

Requirements:
- The app must use alternate-screen mode and restore the terminal correctly on normal exit, Ctrl+C, thrown errors, and test teardown.
- Implement large, medium, compact, too-small layout states.
- Add global q/Escape behavior with modal-safe command routing.
- Add strict lint/typecheck/test scripts.
- Add character-frame snapshot tests at 140x40, 110x30, 90x26, 72x22, and 52x16.
- Keep components modular and do not put the entire layout in App.tsx.
- Run all checks and fix failures before finishing.

At completion, report:
1. files created or changed,
2. architecture decisions,
3. commands to run the app and tests,
4. known OpenTUI constraints discovered,
5. evidence that typecheck and tests pass.
```

## 26. Primary references

- OpenTUI documentation: https://opentui.com/docs/getting-started/
- OpenTUI React bindings: https://opentui.com/docs/bindings/react/
- OpenTUI keymap: https://opentui.com/docs/keymap/overview/
- OpenTUI testing: https://opentui.com/docs/core-concepts/testing/
- OpenTUI standalone executables: https://opentui.com/docs/reference/standalone-executables/
- Spotify Web API: https://developer.spotify.com/documentation/web-api
- Spotify Authorization Code with PKCE: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- Spotify redirect URI rules: https://developer.spotify.com/documentation/web-api/concepts/redirect_uri
- Spotify scopes: https://developer.spotify.com/documentation/web-api/concepts/scopes
- Spotify 2026 Development Mode migration guide: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- Spotify design and attribution rules: https://developer.spotify.com/documentation/design
- Spotify developer policy: https://developer.spotify.com/policy
- LRCLIB API: https://lrclib.net/docs
- Bun Secrets API: https://bun.com/docs/runtime/secrets
