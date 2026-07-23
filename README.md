# SpoTUI

Quick install (latest):

```powershell
irm https://raw.githubusercontent.com/umeraamir09/SpoTUI/main/install.ps1 | iex
```

SpoTUI is a keyboard-first terminal remote for Spotify Connect. It controls playback on existing Spotify clients and does not stream audio.

## Features

- Spotify playback control from the terminal
- Device transfer and queue management
- Search tracks and add to queue
- Browse liked songs and playlists
- Optional synced lyrics panel
- Theme presets and custom theme files
- Keyboard and mouse support

## Requirements

- [Bun](https://bun.sh/) >= 1.2.0
- Spotify account (Premium required for Spotify Connect playback control)
- Spotify app registered in the Spotify Developer Dashboard

## Spotify Configuration

1. Create an app in Spotify Developer Dashboard.
2. Add this Redirect URI exactly:

```text
http://127.0.0.1/callback
```

3. Start SpoTUI and provide your Client ID, or set:

```bash
export SPOTIFY_CLIENT_ID="your_client_id"
```

The app stores non-secret config in the platform config directory and keeps refresh tokens in the OS credential store.

## Installation

### From source

```bash
bun install
bun run start
```

### Script installers

- macOS/Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/umeraamir09/SpoTUI/main/install.sh | bash
```

- Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/umeraamir09/SpoTUI/main/install.ps1 | iex
```

## Usage

Run:

```bash
bun run start
```

Common runtime flags:

```bash
bun run start -- --no-animations
bun run start -- --no-art
bun run start -- --ascii
bun run start -- --256-color
bun run start -- --monochrome
bun run start -- --theme warm-phosphor
bun run start -- --theme midnight-blue
bun run start -- --theme forest-terminal
bun run start -- --theme rosewave
bun run start -- --theme-file ./my-theme.json
```

## Configuration

- `SPOTIFY_CLIENT_ID`: provides Client ID without entering it in the UI
- `SPOTUI_INSTALL`: overrides installer destination path
- `--theme <name>`: select a built-in theme preset
- `--theme-file <path>`: load a custom JSON theme file

Custom theme JSON example:

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

## Key Controls

- `Space`: play/pause
- `n` / `p`: next/previous
- `h` / `l` or Left/Right: seek 5s
- `+` / `-`: volume
- `m`: mute
- `s`: shuffle
- `r`: repeat mode
- `d`: device picker
- `/`: search
- `u`: queue
- `b`: library
- `q`: quit (when no input field is focused)

## Lyrics

When opened, SpoTUI checks local `.lrc` files in its config `lyrics` directory first, then falls back to LRCLIB. Lyrics failures do not impact playback.

## Development

```bash
bun run typecheck
bun run lint
bun run test:unit
bun run test:integration
bun run test:visual
bun run validate
```

## Project Structure

- `src/app` - app bootstrap and terminal lifecycle
- `src/auth` - OAuth PKCE flow and token lifecycle
- `src/config` - platform config paths and TOML config
- `src/spotify` - Spotify Web API client and schemas
- `src/playback` - playback state and command handling
- `src/discovery` - search, queue, liked songs, playlists
- `src/artwork` - artwork processing and rendering pipeline
- `src/input` - command routing and keymap integration
- `src/lyrics` - local and LRCLIB lyrics providers
- `src/ui` - themed terminal UI components
- `tests/unit` - unit tests
- `tests/integration` - integration tests
- `tests/visual` - visual regression tests

## License

MIT (see `LICENSE`).
