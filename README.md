# UmrooFM

UmrooFM is a keyboard-first terminal remote for Spotify Connect, designed around
a warm retro music-appliance aesthetic. It will control playback on existing
Spotify clients; it will not stream or decode Spotify audio.

The working title is not final. `spotify-tui-plan.md` is the product and
architecture source of truth.

UmrooFM remains a Spotify Connect/Web API remote and does not stream audio.

## Spotify setup

1. Create your own app in the Spotify Developer Dashboard. Under the current
   Development Mode rules, the app owner needs Spotify Premium and can
   allowlist up to five users.
2. Register this redirect URI exactly:

   ```text
   http://127.0.0.1/callback
   ```

   Spotify permits a loopback IP registration without a port. UmrooFM binds an
   available dynamic port and sends the resulting
   `http://127.0.0.1:<port>/callback` URI in the authorization request.
   `localhost` is never used.
3. Start UmrooFM and paste your Client ID into the first-run screen. You can
   instead set `SPOTIFY_CLIENT_ID` in the environment.

The Client ID is stored in the platform config directory. Refresh tokens are
stored separately in the operating-system credential store; access tokens,
refresh tokens, authorization codes, and authorization headers are never
written to application logs.

## Run

```sh
bun install
bun run start
```

Artwork fallbacks can be selected at startup:

```sh
bun run start -- --no-animations
bun run start -- --no-art
bun run start -- --ascii
bun run start -- --256-color
bun run start -- --monochrome
```

Theme presets can be selected without changing source:

```sh
bun run start -- --theme warm-phosphor
bun run start -- --theme midnight-blue
bun run start -- --theme forest-terminal
bun run start -- --theme rosewave
```

You can also change presets inside UmrooFM. Click `THEME` in the header or press
`,` to open Theme Settings. Click `KEYS` in the player header to view the
complete shortcut reference. Up/Down or `j`/`k` previews presets immediately;
Enter or the `OK` button applies and saves the selection. Escape or `X` cancels
and restores the previously applied theme.

For a custom theme, create a JSON file containing one or more semantic color
overrides. Values must be six- or eight-digit hexadecimal colors; unknown
tokens and malformed files are rejected before the terminal renderer starts.

```json
{
  "name": "ocean-radio",
  "extends": "midnight-blue",
  "colors": {
    "accent": "#55DDEE",
    "textPrimary": "#F4FBFF",
    "surfaceRaised": "#102030"
  }
}
```

```sh
bun run start -- --theme-file ./ocean-radio.json
```

Press `q` from an unfocused surface to quit. While entering a Client ID,
keystrokes belong to the input and cannot trigger global quit. `Ctrl+C` always
performs renderer cleanup, and `Escape` cancels an active authorization attempt.

Player controls:

- `Space`: play/pause
- `n` / `p`: next/previous
- `h` / `l` or Left/Right: seek 5 seconds
- `H` / `L`: seek 30 seconds
- `+` / `-`: volume
- `m`: mute/restore
- `s`: shuffle
- `r`: cycle repeat
- `d`: choose or transfer Spotify Connect device
- `y`: show/hide lyrics; Up/Down or `j`/`k` scroll manually (auto-follow resumes after a short pause)
- `i`: show track information
- `/`: search Spotify tracks
- `u`: view and refresh the playback queue
- `b`: browse liked songs and playlists
- `Tab` / `Shift+Tab`: move focus through visible player regions

Search controls:

- type in the focused input; search starts after 300 ms of inactivity
- `Down`: move from the input into results
- `Up` / `Down` or `j` / `k`: select a result
- `Enter` / `a`: add the selected result to the playback queue without
  replacing the current Spotify context
- `f`: save to Liked Songs
- `v`: choose a playlist and add the track
- `o`: open the result in Spotify
- `PageUp` / `PageDown`: move through result pages
- `/`: return focus to the search input

Library controls:

- `Left` / `Right`: switch between Liked Songs and Playlists
- `Up` / `Down` or `j` / `k`: select an item
- `Enter`: play a liked song, or open a playlist
- `p`: play the selected song or full playlist
- `a`: add a selected playlist track to the queue
- `f`: save a selected playlist track
- `Backspace`: return from playlist items to the Library root
- `PageUp` / `PageDown`: move through library pages

Phase 4 adds library and playlist OAuth permissions. An account authorized by
an older build may need to be disconnected and authorized again before Spotify
will grant the new scopes.

Every visible player control also supports the mouse. Click transport, volume,
mute, and device buttons directly; click or drag anywhere on the progress track
to seek. Device rows can be hovered and clicked, and the picker has a clickable
close button. Keyboard shortcuts remain active alongside mouse input.

## Lyrics

Lyrics are optional. When the lyrics panel is opened, UmrooFM first looks for a
local `.lrc` file in its config-directory `lyrics` folder, named either with the
Spotify track ID or its normalized `artist_title_album_duration` key. It then
falls back to LRCLIB. Failed or missing lyrics never affect Spotify playback.

## Validate

```sh
bun run typecheck
bun run lint
bun run test:unit
bun run test:integration
bun run test:visual
bun run validate
```

The visual suite captures frames at `140×40`, `110×30`, `90×26`, `72×22`, and
`52×16`. The hard minimum is `52×16`; smaller terminals receive a centered
resize message.

## Architecture boundary

- `src/app`: React root, bootstrap, terminal lifecycle, and fatal cleanup
- `src/auth`: PKCE, callback server, controller, token lifecycle, and secret
  storage boundary
- `src/config`: platform paths and non-secret TOML configuration
- `src/spotify`: typed Web API transport, schemas, and rate-limit errors
- `src/playback`: observable playback controller, polling policy, progress
  clock, optimistic commands, and domain models
- `src/discovery`: observable search, queue, liked-song, and playlist state
  with cancellation, paging, and post-command reconciliation
- `src/artwork`: fetch limits, reusable worker decoding, bounded caches,
  cooperative rasterization, visibility-aware rotation, and artwork domain state
- `src/input`: named commands, pure command routing, and OpenTUI keymap adapter
- `src/lyrics`: optional local LRC and LRCLIB providers, cache, cancellation, and sync timing
- `src/ui`: semantic/capability-aware theme, responsive policy, modular shell
  components, focus state, and transient notifications
- `tests/unit`: pure state and lifecycle behavior
- `tests/integration`: renderer, keymap, callback, auth, restart restore, and
  Spotify transport behavior
- `tests/visual`: character-frame and styled-span regression coverage

Later phases must keep playback domain state, artwork work, and optional lyrics
providers separate from auth, transport, input routing, and React rendering.
