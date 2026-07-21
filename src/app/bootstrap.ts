import {
  createCliRenderer,
  type CliRenderer,
  type CliRendererConfig,
} from "@opentui/core"
import { createRoot } from "@opentui/react"
import { createElement } from "react"

import { App } from "./App"
import { installFatalHandlers } from "./fatal-handlers"
import { createRendererLifecycle } from "./renderer-lifecycle"
import {
  createApplicationControllers,
} from "../auth/create-auth-controller"
import type { AuthControllerPort } from "../auth/auth-controller"
import {
  createStaticArtworkController,
  type ArtworkControllerPort,
} from "../artwork/artwork-service"
import {
  parseRuntimeUiOptions,
  type RuntimeUiOptions,
} from "../config/runtime-ui-options"
import {
  ConfigValidationError,
  MemoryConfigStore,
  type ConfigStore,
} from "../config/config"
import {
  createStaticPlaybackController,
  type PlaybackControllerPort,
} from "../playback/playback-controller"
import {
  createStaticLyricsController,
  type LyricsControllerPort,
} from "../lyrics/lyrics-service"
import {
  createStaticDiscoveryController,
  type DiscoveryControllerPort,
} from "../discovery/discovery-controller"
import {
  UiController,
  type UiControllerPort,
} from "../ui/state/ui-controller"
import {
  loadCustomThemeFile,
  type CustomThemeDefinition,
} from "../ui/theme/custom-theme"
import { resolveAppTheme } from "../ui/theme/theme"
import { isThemePresetName } from "../ui/theme/palette"

export type RendererFactory = (
  config: CliRendererConfig,
) => Promise<CliRenderer>

export interface BootstrapOptions {
  authController?: AuthControllerPort
  playbackController?: PlaybackControllerPort
  discoveryController?: DiscoveryControllerPort
  artworkController?: ArtworkControllerPort
  uiController?: UiControllerPort
  uiOptions?: RuntimeUiOptions
  customTheme?: CustomThemeDefinition | undefined
  configStore?: ConfigStore
  lyricsController?: LyricsControllerPort
  createRenderer?: RendererFactory
  reportFatal?: (error: unknown) => void
}

function defaultFatalReporter(error: unknown): void {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  process.stderr.write(`UmrooFM stopped after an unexpected error.\n${message}\n`)
}

export async function bootstrap({
  authController,
  playbackController,
  discoveryController,
  artworkController,
  uiController,
  uiOptions = parseRuntimeUiOptions(process.argv.slice(2)),
  customTheme,
  configStore,
  lyricsController,
  createRenderer = createCliRenderer,
  reportFatal = defaultFatalReporter,
}: BootstrapOptions = {}): Promise<void> {
  const defaults =
    authController === undefined && playbackController === undefined
      ? createApplicationControllers()
      : null
  const resolvedAuthController =
    authController ?? defaults?.authController
  const resolvedPlaybackController =
    playbackController ??
    defaults?.playbackController ??
    createStaticPlaybackController()
  const resolvedArtworkController =
    artworkController ??
    defaults?.artworkController ??
    createStaticArtworkController()
  const resolvedUiController =
    uiController ?? defaults?.uiController ?? new UiController()
  const resolvedDiscoveryController =
    discoveryController ??
    defaults?.discoveryController ??
    createStaticDiscoveryController()
  const resolvedConfigStore =
    configStore ??
    defaults?.configStore ??
    new MemoryConfigStore(null, uiOptions.themePreset)
  const resolvedLyricsController =
    lyricsController ?? defaults?.lyricsController ?? createStaticLyricsController()
  if (resolvedAuthController === undefined) {
    throw new Error("Authentication controller is required")
  }
  // Resolve a saved session before the renderer owns the terminal. This keeps
  // returning listeners on the player surface instead of briefly flashing the
  // authorization screen on every launch.
  resolvedAuthController.initialize()
  await resolvedAuthController.whenIdle()
  const resolvedCustomTheme =
    customTheme ??
    (uiOptions.themeFile === null
      ? undefined
      : await loadCustomThemeFile(uiOptions.themeFile))
  const persistedThemePreset =
    uiOptions.themePresetExplicit || uiOptions.themeFile !== null
      ? null
      : await resolvedConfigStore.getThemePreset()
  if (
    persistedThemePreset !== null &&
    !isThemePresetName(persistedThemePreset)
  ) {
    throw new ConfigValidationError(
      `Unknown UI theme preset: ${persistedThemePreset}`,
    )
  }
  const resolvedUiOptions =
    persistedThemePreset === null
      ? uiOptions
      : {
          ...uiOptions,
          themePreset: persistedThemePreset,
        }
  const startupTheme = resolveAppTheme(
    resolvedUiOptions,
    null,
    resolvedCustomTheme,
  )

  let renderer: CliRenderer | undefined
  let root: ReturnType<typeof createRoot> | undefined
  let disposeFatalHandlers: () => void = () => void 0

  const unmountRoot = () => {
    root?.unmount()
    root = undefined
  }

  try {
    renderer = await createRenderer({
      backgroundColor: startupTheme.colors.background,
      clearOnShutdown: true,
      consoleMode: "disabled",
      exitOnCtrlC: true,
      screenMode: "alternate-screen",
      targetFps: 12,
      // OpenTUI uses maxFps (rather than targetFps) to throttle
      // event-driven renders. Keep independently scheduled UI updates from
      // producing more terminal frames than the visual design requires.
      maxFps: 12,
    })

    const lifecycle = createRendererLifecycle(renderer)
    disposeFatalHandlers = installFatalHandlers({
      lifecycle,
      report: reportFatal,
    })

    root = createRoot(renderer)
    root.render(
      createElement(App, {
        authController: resolvedAuthController,
        artworkController: resolvedArtworkController,
        playbackController: resolvedPlaybackController,
        discoveryController: resolvedDiscoveryController,
        uiController: resolvedUiController,
        uiOptions: resolvedUiOptions,
        customTheme: resolvedCustomTheme,
        configStore: resolvedConfigStore,
        lyricsController: resolvedLyricsController,
        onQuit: () => {
          unmountRoot()
          lifecycle.shutdown()
        },
      }),
    )

    await lifecycle.closed
  } catch (error) {
    if (renderer && !renderer.isDestroyed) {
      renderer.destroy()
    }
    throw error
  } finally {
    disposeFatalHandlers()
    unmountRoot()
    if (renderer && !renderer.isDestroyed) {
      renderer.destroy()
    }
  }
}
