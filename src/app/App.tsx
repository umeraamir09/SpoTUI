import {
  CliRenderEvents,
  type TerminalCapabilities,
} from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { KeymapProvider } from "@opentui/keymap/react"
import {
  useRenderer,
  useTerminalDimensions,
} from "@opentui/react"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import type { AuthControllerPort } from "../auth/auth-controller"
import {
  createStaticArtworkController,
  type ArtworkControllerPort,
} from "../artwork/artwork-service"
import type { RuntimeUiOptions } from "../config/runtime-ui-options"
import {
  MemoryConfigStore,
  type ConfigStore,
} from "../config/config"
import type { CustomThemeDefinition } from "../ui/theme/custom-theme"
import {
  createCommandRouter,
  type InteractionState,
} from "../input/command-router"
import { AuthCommandLayer } from "../input/auth-keymap"
import { GlobalCommandLayer } from "../input/keymap"
import {
  DeviceCommandLayer,
  PlaybackCommandLayer,
} from "../input/playback-keymap"
import { FocusCommandLayer } from "../input/ui-keymap"
import { LyricsCommandLayer } from "../input/lyrics-keymap"
import {
  SettingsCommandLayer,
  SettingsModalCommandLayer,
} from "../input/settings-keymap"
import type { PlaybackControllerPort } from "../playback/playback-controller"
import {
  createStaticLyricsController,
  type LyricsControllerPort,
} from "../lyrics/lyrics-service"
import type { ContextPanelTab } from "../ui/components/ContextPanel"
import {
  createStaticDiscoveryController,
  type DiscoveryControllerPort,
} from "../discovery/discovery-controller"
import type {
  MediaItem,
  PlaylistSummary,
} from "../discovery/types"
import {
  DiscoveryOpenCommandLayer,
  LibraryCommandLayer,
  QueueCommandLayer,
  SearchCommandLayer,
} from "../input/discovery-keymap"
import { AuthSurface } from "../ui/components/AuthSurface"
import { DeviceSurface } from "../ui/components/DeviceSurface"
import { BrowsePage } from "../ui/components/BrowsePage"
import { PlayerShell } from "../ui/components/PlayerShell"
import {
  SettingsSurface,
  type SettingsSaveStatus,
} from "../ui/components/SettingsSurface"
import type { PlayerActions } from "../ui/components/player-actions"
import { ToastHost } from "../ui/components/ToastHost"
import { SearchSurface } from "../ui/components/SearchSurface"
import { QueueSurface } from "../ui/components/QueueSurface"
import { LibrarySurface } from "../ui/components/LibrarySurface"
import { KeybindsSurface } from "../ui/components/KeybindsSurface"
import { openExternalUrl } from "../platform/open-url"
import { resolveArtworkFrameSize } from "../ui/layout/artwork-layout"
import { resolveLayoutMode } from "../ui/layout/layout"
import {
  UiController,
  type UiControllerPort,
  type UiFocusTarget,
  type UiToastTone,
} from "../ui/state/ui-controller"
import { resolveAppTheme } from "../ui/theme/theme"
import type { AppPage } from "../ui/navigation/page"
import { AppThemeProvider } from "../ui/theme/theme-context"
import { UiAnimationProvider } from "../ui/animation/animation-context"
import {
  isThemePresetName,
  THEME_PRESET_NAMES,
  type ThemePresetName,
} from "../ui/theme/palette"

export interface AppProps {
  authController: AuthControllerPort
  playbackController: PlaybackControllerPort
  discoveryController?: DiscoveryControllerPort
  artworkController?: ArtworkControllerPort
  uiController?: UiControllerPort
  uiOptions?: RuntimeUiOptions
  customTheme?: CustomThemeDefinition | undefined
  configStore?: ConfigStore
  lyricsController?: LyricsControllerPort
  onQuit: () => void
}

const EMPTY_ARTWORK_CONTROLLER = createStaticArtworkController()
const EMPTY_DISCOVERY_CONTROLLER = createStaticDiscoveryController()
const EMPTY_LYRICS_CONTROLLER = createStaticLyricsController()
const DEFAULT_UI_OPTIONS: RuntimeUiOptions = {
  albumArt: true,
  animations: true,
  asciiArtwork: false,
  colorMode: "auto",
  themeFile: null,
  themePreset: "warm-phosphor",
  themePresetExplicit: false,
}
export function App({
  authController,
  playbackController,
  discoveryController = EMPTY_DISCOVERY_CONTROLLER,
  artworkController = EMPTY_ARTWORK_CONTROLLER,
  uiController,
  uiOptions = DEFAULT_UI_OPTIONS,
  customTheme,
  configStore,
  lyricsController = EMPTY_LYRICS_CONTROLLER,
  onQuit,
}: AppProps) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const internalUiController = useMemo(() => new UiController(), [])
  const resolvedUiController = uiController ?? internalUiController
  const internalConfigStore = useMemo(
    () => new MemoryConfigStore(null, uiOptions.themePreset),
    [uiOptions.themePreset],
  )
  const resolvedConfigStore = configStore ?? internalConfigStore
  const authState = useSyncExternalStore(
    authController.subscribe,
    authController.getSnapshot,
  )
  const playbackState = useSyncExternalStore(
    playbackController.subscribe,
    playbackController.getSnapshot,
  )
  const discoveryState = useSyncExternalStore(
    discoveryController.subscribe,
    discoveryController.getSnapshot,
  )
  const uiState = useSyncExternalStore(
    resolvedUiController.subscribe,
    resolvedUiController.getSnapshot,
  )
  const lyricsState = useSyncExternalStore(
    lyricsController.subscribe,
    lyricsController.getSnapshot,
  )
  const [capabilities, setCapabilities] =
    useState<TerminalCapabilities | null>(renderer.capabilities)
  const [terminalFocused, setTerminalFocused] = useState(true)
  const [activePage, setActivePage] = useState<AppPage>("player")
  const [, setPageHistory] = useState<readonly AppPage[]>([])
  const [searchInputFocused, setSearchInputFocused] = useState(true)
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0)
  const searchSelectedIndexRef = useRef(searchSelectedIndex)
  searchSelectedIndexRef.current = searchSelectedIndex
  const [queueSelectedIndex, setQueueSelectedIndex] = useState(0)
  const queueSelectedIndexRef = useRef(queueSelectedIndex)
  queueSelectedIndexRef.current = queueSelectedIndex
  const [librarySection, setLibrarySection] = useState<
    "liked" | "playlists"
  >("liked")
  const [librarySelectedIndex, setLibrarySelectedIndex] = useState(0)
  const librarySelectedIndexRef = useRef(librarySelectedIndex)
  librarySelectedIndexRef.current = librarySelectedIndex
  const [libraryAddTarget, setLibraryAddTarget] =
    useState<MediaItem | null>(null)
  const initialThemePreset = isThemePresetName(uiOptions.themePreset)
    ? uiOptions.themePreset
    : "warm-phosphor"
  const [activeThemePreset, setActiveThemePreset] =
    useState<ThemePresetName>(initialThemePreset)
  const [activeCustomTheme, setActiveCustomTheme] = useState<
    CustomThemeDefinition | undefined
  >(customTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [keybindsOpen, setKeybindsOpen] = useState(false)
  const [settingsCommittedTheme, setSettingsCommittedTheme] =
    useState<ThemePresetName>(initialThemePreset)
  const [settingsSaveStatus, setSettingsSaveStatus] =
    useState<SettingsSaveStatus>("idle")
  const committedThemeRef = useRef(initialThemePreset)
  const committedCustomThemeRef = useRef<
    CustomThemeDefinition | undefined
  >(customTheme)
  const selectedThemeIndexRef = useRef(
    THEME_PRESET_NAMES.indexOf(initialThemePreset),
  )
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0)
  const [contextTab, setContextTab] = useState<ContextPanelTab>("queue")
  const [lyricsManualOffset, setLyricsManualOffset] = useState<number | null>(null)
  const visibleToasts = uiState.toasts
  useEffect(() => {
    const notice = discoveryState.notice
    if (notice === null) {
      return
    }
    resolvedUiController.showToast({
      key: notice.key,
      message: notice.message,
      tone:
        notice.tone === "success"
          ? "success"
          : notice.tone === "warning"
            ? "warning"
            : "error",
    })
  }, [
    discoveryState.notice?.key,
    discoveryState.notice?.message,
    discoveryState.notice?.tone,
    resolvedUiController,
  ])
  const selectedDeviceIndexRef = useRef(selectedDeviceIndex)
  selectedDeviceIndexRef.current = selectedDeviceIndex
  const keymap = useMemo(
    () => createDefaultOpenTuiKeymap(renderer),
    [renderer],
  )
  const interactionState: InteractionState = {
    modalOpen:
      authState.status === "authorizing" ||
      settingsOpen ||
      keybindsOpen ||
      activePage !== "player",
    textInputFocused:
      authState.status === "needs-client-id" ||
      (activePage === "search" && searchInputFocused),
  }
  const interactionRef = useRef(interactionState)
  interactionRef.current = interactionState

  const cancelAuthorization = useCallback(() => {
    authController.cancel()
  }, [authController])
  const cancelSettings = useCallback(() => {
    setActiveThemePreset(committedThemeRef.current)
    setActiveCustomTheme(committedCustomThemeRef.current)
    setSettingsSaveStatus("idle")
    setSettingsOpen(false)
  }, [])
  const navigateTo = useCallback((page: AppPage) => {
    setActivePage((current) => {
      if (current === page) {
        return current
      }
      setPageHistory((history) => [...history, current].slice(-12))
      return page
    })
    if (page === "search") {
      setSearchSelectedIndex(0)
      setSearchInputFocused(true)
    }
    if (page === "queue") {
      setQueueSelectedIndex(0)
    }
    if (page === "library") {
      setLibraryAddTarget(null)
      setLibrarySelectedIndex(0)
      setLibrarySection("liked")
      void discoveryController.refreshLibrary()
    }
    if (page === "devices") {
      const activeIndex = playbackState.devices.findIndex(
        (device) => device.isActive,
      )
      const nextIndex = activeIndex >= 0 ? activeIndex : 0
      selectedDeviceIndexRef.current = nextIndex
      setSelectedDeviceIndex(nextIndex)
    }
  }, [playbackState.devices])
  const goBack = useCallback(() => {
    if (keybindsOpen) {
      setKeybindsOpen(false)
      return
    }
    if (settingsOpen) {
      cancelSettings()
      return
    }
    if (activePage === "library") {
      if (discoveryState.library.activePlaylist !== null) {
        discoveryController.closePlaylist()
        setLibrarySelectedIndex(0)
        return
      }
      setLibraryAddTarget(null)
    }
    if (authState.status === "authorizing") {
      cancelAuthorization()
      return
    }
    setPageHistory((history) => {
      const previous = history.at(-1) ?? "player"
      setActivePage(previous)
      return history.slice(0, -1)
    })
  }, [
    activePage,
    authState.status,
    cancelAuthorization,
    cancelSettings,
    discoveryController,
    discoveryState.library.activePlaylist,
    keybindsOpen,
    settingsOpen,
  ])
  const login = useCallback(() => {
    authController.login()
  }, [authController])
  const retry = useCallback(() => {
    authController.retry()
  }, [authController])

  useEffect(() => {
    authController.initialize()
  }, [authController])

  useEffect(() => {
    if (authState.status !== "authenticated") {
      playbackController.stop()
      return
    }

    playbackController.start()
    return () => {
      playbackController.stop()
    }
  }, [authState.status, playbackController])

  useEffect(() => {
    const onFocus = () => {
      setTerminalFocused(true)
      playbackController.setTerminalFocused(true)
      artworkController.setTerminalFocused(true)
    }
    const onBlur = () => {
      setTerminalFocused(false)
      playbackController.setTerminalFocused(false)
      artworkController.setTerminalFocused(false)
    }
    renderer.on(CliRenderEvents.FOCUS, onFocus)
    renderer.on(CliRenderEvents.BLUR, onBlur)
    return () => {
      renderer.off(CliRenderEvents.FOCUS, onFocus)
      renderer.off(CliRenderEvents.BLUR, onBlur)
    }
  }, [artworkController, playbackController, renderer])

  useEffect(() => {
    const onCapabilities = (next: TerminalCapabilities) => {
      setCapabilities(next)
    }
    renderer.on(CliRenderEvents.CAPABILITIES, onCapabilities)
    return () => {
      renderer.off(CliRenderEvents.CAPABILITIES, onCapabilities)
    }
  }, [renderer])

  const layoutMode = resolveLayoutMode(dimensions)
  const activeUiOptions = useMemo(
    () => ({
      ...uiOptions,
      themePreset: activeThemePreset,
    }),
    [activeThemePreset, uiOptions],
  )
  const appTheme = useMemo(
    () =>
      resolveAppTheme(
        activeUiOptions,
        capabilities,
        activeCustomTheme,
      ),
    [activeCustomTheme, activeUiOptions, capabilities],
  )
  const artworkFrameSize = resolveArtworkFrameSize(
    layoutMode,
    dimensions,
  )
  const currentItem = playbackState.playback?.item ?? null
  const artworkSourceKey =
    currentItem === null
      ? null
      : `${currentItem.kind}:${currentItem.id ?? currentItem.uri ?? currentItem.title}`

  useEffect(() => {
    resolvedUiController.setFocusTargets(
      visibleFocusTargets(
        layoutMode,
        playbackState.status === "ready" && currentItem !== null,
      ),
    )
  }, [
    currentItem,
    layoutMode,
    playbackState.status,
    resolvedUiController,
  ])

  useEffect(() => {
    if (contextTab !== "lyrics") {
      return
    }
    lyricsController.load(currentItem)
    setLyricsManualOffset(null)
  }, [contextTab, currentItem, lyricsController])

  useEffect(() => {
    const queueIsVisible =
      activePage === "queue" ||
      (activePage === "player" && contextTab === "queue")
    if (
      authState.status !== "authenticated" ||
      !queueIsVisible ||
      settingsOpen ||
      keybindsOpen
    ) {
      return
    }

    const refresh = () => {
      void discoveryController.refreshQueue()
    }
    refresh()
    const timer = setInterval(refresh, 5_000)
    return () => clearInterval(timer)
  }, [
    activePage,
    authState.status,
    contextTab,
    discoveryController,
    keybindsOpen,
    settingsOpen,
  ])

  useEffect(() => {
    if (lyricsManualOffset === null) {
      return
    }
    const timer = setTimeout(() => setLyricsManualOffset(null), 4_000)
    return () => clearTimeout(timer)
  }, [lyricsManualOffset])

  useEffect(() => {
    const notice = playbackState.notice
    if (notice === null) {
      return
    }
    resolvedUiController.showToast({
      key: `playback:${notice.kind}:${notice.message}`,
      message: notice.message,
      tone: noticeTone(notice.kind),
    })
  }, [
    playbackState.notice?.kind,
    playbackState.notice?.message,
    resolvedUiController,
  ])

  useEffect(() => {
    setSearchSelectedIndex(0)
  }, [discoveryState.search.page.offset, discoveryState.search.query])

  useEffect(() => {
    setQueueSelectedIndex((current) =>
      Math.min(
        current,
        Math.max(0, discoveryState.queue.snapshot.items.length - 1),
      ),
    )
  }, [discoveryState.queue.snapshot.items.length])

  useEffect(() => {
    setLibrarySelectedIndex(0)
  }, [
    discoveryState.library.activePlaylist?.id,
    discoveryState.library.playlistItems.offset,
    discoveryState.library.snapshot.likedTracks.offset,
    discoveryState.library.snapshot.playlists.offset,
    librarySection,
  ])

  useEffect(() => {
    if (
      authState.status !== "authenticated" ||
      currentItem === null ||
      artworkFrameSize === null ||
      artworkSourceKey === null ||
      !uiOptions.albumArt ||
      activePage !== "player" ||
      settingsOpen
    ) {
      artworkController.setArtwork(null)
      return
    }
    artworkController.setArtwork({
      animations: uiOptions.animations,
      height: artworkFrameSize.height,
      isPlaying: playbackState.playback?.isPlaying === true,
      key: artworkSourceKey,
      url: currentItem.imageUrl,
      width: artworkFrameSize.width,
    })
  }, [
    artworkController,
    artworkFrameSize?.height,
    artworkFrameSize?.width,
    artworkSourceKey,
    activePage,
    authState.status,
    currentItem,
    playbackState.playback?.isPlaying,
    settingsOpen,
    uiOptions.albumArt,
    uiOptions.animations,
  ])

  useEffect(
    () => () => {
      artworkController.stop()
      discoveryController.stop()
      lyricsController.stop()
      resolvedUiController.stop()
    },
    [artworkController, discoveryController, lyricsController, resolvedUiController],
  )

  const router = useMemo(
    () =>
      createCommandRouter({
        getInteractionState: () => interactionRef.current,
        closeModal: goBack,
        quit: onQuit,
      }),
    [goBack, onQuit],
  )

  const authAction =
    authState.status === "ready"
      ? "login"
      : authState.status === "error" && authState.retryable
        ? "retry"
        : null

  const openDevices = useCallback(() => {
    navigateTo("devices")
  }, [navigateTo])
  const openSettings = useCallback(() => {
    committedThemeRef.current = activeThemePreset
    committedCustomThemeRef.current = activeCustomTheme
    selectedThemeIndexRef.current = THEME_PRESET_NAMES.indexOf(
      activeThemePreset,
    )
    setSettingsCommittedTheme(activeThemePreset)
    setSettingsSaveStatus("idle")
    setSettingsOpen(true)
  }, [activeCustomTheme, activeThemePreset])
  const openKeybinds = useCallback(() => {
    setKeybindsOpen(true)
  }, [])
  const openSearch = useCallback(() => {
    navigateTo("search")
  }, [navigateTo])
  const openQueue = useCallback(() => {
    navigateTo("queue")
  }, [navigateTo])
  const openLibrary = useCallback(() => {
    navigateTo("library")
  }, [navigateTo])
  const toggleLyrics = useCallback(() => {
    setContextTab((tab) => {
      const next = tab === "lyrics" ? "queue" : "lyrics"
      if (next === "lyrics") {
        lyricsController.load(currentItem)
      } else {
        lyricsController.stop()
      }
      return next
    })
    setLyricsManualOffset(null)
  }, [currentItem, lyricsController])
  const openInfoPanel = useCallback(() => {
    setContextTab("info")
    setLyricsManualOffset(null)
  }, [])
  const scrollLyrics = useCallback((direction: -1 | 1) => {
    setLyricsManualOffset((offset) => Math.max(0, (offset ?? 0) + direction))
  }, [])
  const selectTheme = useCallback((preset: ThemePresetName) => {
    selectedThemeIndexRef.current =
      THEME_PRESET_NAMES.indexOf(preset)
    setActiveCustomTheme(undefined)
    setActiveThemePreset(preset)
    setSettingsSaveStatus("idle")
  }, [])
  const moveThemeSelection = useCallback(
    (direction: -1 | 1) => {
      const nextIndex =
        (selectedThemeIndexRef.current +
          direction +
          THEME_PRESET_NAMES.length) %
        THEME_PRESET_NAMES.length
      const preset =
        THEME_PRESET_NAMES[nextIndex] ?? "warm-phosphor"
      selectTheme(preset)
    },
    [selectTheme],
  )
  const applySettings = useCallback(() => {
    if (settingsSaveStatus === "saving") {
      return
    }
    const preset = activeThemePreset
    setSettingsSaveStatus("saving")
    void resolvedConfigStore
      .setThemePreset(preset)
      .then(() => {
        committedThemeRef.current = preset
        committedCustomThemeRef.current = undefined
        setSettingsCommittedTheme(preset)
        setSettingsSaveStatus("idle")
        setSettingsOpen(false)
      })
      .catch(() => {
        setSettingsSaveStatus("error")
      })
  }, [
    activeThemePreset,
    resolvedConfigStore,
    settingsSaveStatus,
  ])
  const selectPreviousTheme = useCallback(() => {
    moveThemeSelection(-1)
  }, [moveThemeSelection])
  const selectNextTheme = useCallback(() => {
    moveThemeSelection(1)
  }, [moveThemeSelection])
  const selectPreviousDevice = useCallback(() => {
    const nextIndex =
      playbackState.devices.length === 0
        ? 0
        : (selectedDeviceIndexRef.current -
            1 +
            playbackState.devices.length) %
          playbackState.devices.length
    selectedDeviceIndexRef.current = nextIndex
    setSelectedDeviceIndex(nextIndex)
  }, [playbackState.devices.length])
  const selectNextDevice = useCallback(() => {
    const nextIndex =
      playbackState.devices.length === 0
        ? 0
        : (selectedDeviceIndexRef.current + 1) %
          playbackState.devices.length
    selectedDeviceIndexRef.current = nextIndex
    setSelectedDeviceIndex(nextIndex)
  }, [playbackState.devices.length])
  const transferToDeviceAt = useCallback(
    (index: number, play: boolean) => {
      const selected = playbackState.devices[index]
      if (selected?.id === null || selected?.id === undefined) {
        return
      }
      playbackController.transferTo(selected.id, play)
    },
    [
      playbackController,
      playbackState.devices,
    ],
  )
  const transferToSelectedDevice = useCallback(
    (play: boolean) => {
      transferToDeviceAt(selectedDeviceIndexRef.current, play)
    },
    [transferToDeviceAt],
  )

  const getActiveDeviceId = useCallback((): string | undefined => {
    const active =
      playbackState.playback?.device ??
      playbackState.devices.find((device) => device.isActive)
    return active?.id ?? undefined
  }, [playbackState.devices, playbackState.playback?.device])
  const requireActiveDevice = useCallback((): string | undefined => {
    const deviceId = getActiveDeviceId()
    if (deviceId !== undefined) {
      return deviceId
    }
    resolvedUiController.showToast({
      key: "discovery:no-active-device",
      message:
        "Choose a Spotify device, then retry the requested playback action.",
      tone: "warning",
    })
    openDevices()
    return undefined
  }, [getActiveDeviceId, openDevices, resolvedUiController])

  const playMediaItem = useCallback(
    (item: MediaItem) => {
      const deviceId = requireActiveDevice()
      if (deviceId !== undefined) {
        void discoveryController.playItem(item, deviceId)
      }
    },
    [discoveryController, requireActiveDevice],
  )
  const queueMediaItem = useCallback(
    (item: MediaItem) => {
      const deviceId = requireActiveDevice()
      if (deviceId !== undefined) {
        void discoveryController.queueItem(item, deviceId)
      }
    },
    [discoveryController, requireActiveDevice],
  )
  const saveMediaItem = useCallback(
    (item: MediaItem) => {
      void discoveryController.saveItem(item)
    },
    [discoveryController],
  )
  const openMediaItem = useCallback(
    (item: MediaItem) => {
      if (item.spotifyUrl === null) {
        resolvedUiController.showToast({
          key: `spotify-url:${item.uri ?? item.title}`,
          message: "Spotify did not provide an external link for this item.",
          tone: "warning",
        })
        return
      }
      void openExternalUrl(item.spotifyUrl).catch(() => {
        resolvedUiController.showToast({
          key: `spotify-url-error:${item.uri ?? item.title}`,
          message: "Could not open this item in Spotify.",
          tone: "error",
        })
      })
    },
    [resolvedUiController],
  )
  const addMediaToPlaylist = useCallback(
    (item: MediaItem) => {
      setLibraryAddTarget(item)
      setLibrarySection("playlists")
      setLibrarySelectedIndex(0)
      setActivePage("library")
      setPageHistory((history) =>
        activePage === "library" ? history : [...history, activePage].slice(-12),
      )
      void discoveryController.refreshLibrary()
    },
    [activePage, discoveryController],
  )

  const moveSearchSelection = useCallback(
    (direction: -1 | 1) => {
      const count = discoveryState.search.page.items.length
      if (count === 0) {
        return
      }
      setSearchInputFocused(false)
      setSearchSelectedIndex((current) => {
        const next = (current + direction + count) % count
        searchSelectedIndexRef.current = next
        return next
      })
    },
    [discoveryState.search.page.items.length],
  )
  const selectedSearchItem = useCallback(
    () =>
      discoveryState.search.page.items[
        searchSelectedIndexRef.current
      ] ?? null,
    [discoveryState.search.page.items],
  )
  const runSelectedSearchAction = useCallback(
    (action: (item: MediaItem) => void) => {
      const selected = selectedSearchItem()
      if (selected !== null) {
        action(selected)
      }
    },
    [selectedSearchItem],
  )
  const moveQueueSelection = useCallback(
    (direction: -1 | 1) => {
      const count = discoveryState.queue.snapshot.items.length
      if (count === 0) {
        return
      }
      setQueueSelectedIndex((current) => {
        const next = (current + direction + count) % count
        queueSelectedIndexRef.current = next
        return next
      })
    },
    [discoveryState.queue.snapshot.items.length],
  )
  const playSelectedQueueItem = useCallback(() => {
    const item =
      discoveryState.queue.snapshot.items[
        queueSelectedIndexRef.current
      ]
    if (item !== undefined) {
      playMediaItem(item)
    }
  }, [discoveryState.queue.snapshot.items, playMediaItem])
  const currentLibraryItems = useCallback(() => {
    if (discoveryState.library.activePlaylist !== null) {
      return discoveryState.library.playlistItems.items
    }
    if (libraryAddTarget !== null || librarySection === "playlists") {
      return discoveryState.library.snapshot.playlists.items
    }
    return discoveryState.library.snapshot.likedTracks.items
  }, [
    discoveryState.library.activePlaylist,
    discoveryState.library.playlistItems.items,
    discoveryState.library.snapshot.likedTracks.items,
    discoveryState.library.snapshot.playlists.items,
    libraryAddTarget,
    librarySection,
  ])
  const moveLibrarySelection = useCallback(
    (direction: -1 | 1) => {
      const count = currentLibraryItems().length
      if (count === 0) {
        return
      }
      setLibrarySelectedIndex((current) => {
        const next = (current + direction + count) % count
        librarySelectedIndexRef.current = next
        return next
      })
    },
    [currentLibraryItems],
  )
  const changeLibrarySection = useCallback(
    (direction: -1 | 1) => {
      if (
        discoveryState.library.activePlaylist !== null ||
        libraryAddTarget !== null
      ) {
        return
      }
      setLibrarySection((current) =>
        direction === 1
          ? current === "liked"
            ? "playlists"
            : "liked"
          : current === "playlists"
            ? "liked"
            : "playlists",
      )
      setLibrarySelectedIndex(0)
    },
    [discoveryState.library.activePlaylist, libraryAddTarget],
  )
  const selectedLibraryTrack = useCallback((): MediaItem | null => {
    if (discoveryState.library.activePlaylist !== null) {
      return (
        discoveryState.library.playlistItems.items[
          librarySelectedIndexRef.current
        ] ?? null
      )
    }
    if (librarySection === "liked" && libraryAddTarget === null) {
      return (
        discoveryState.library.snapshot.likedTracks.items[
          librarySelectedIndexRef.current
        ] ?? null
      )
    }
    return null
  }, [
    discoveryState.library.activePlaylist,
    discoveryState.library.playlistItems.items,
    discoveryState.library.snapshot.likedTracks.items,
    libraryAddTarget,
    librarySection,
  ])
  const selectedLibraryPlaylist =
    useCallback((): PlaylistSummary | null => {
      return (
        discoveryState.library.snapshot.playlists.items[
          librarySelectedIndexRef.current
        ] ?? null
      )
    }, [discoveryState.library.snapshot.playlists.items])
  const playPlaylist = useCallback(
    (playlist: PlaylistSummary, item?: MediaItem) => {
      const deviceId = requireActiveDevice()
      if (deviceId !== undefined) {
        void discoveryController.playPlaylist(
          playlist,
          item,
          deviceId,
        )
      }
    },
    [discoveryController, requireActiveDevice],
  )
  const selectLibraryItem = useCallback(() => {
    const activePlaylist = discoveryState.library.activePlaylist
    if (activePlaylist !== null) {
      const item = selectedLibraryTrack()
      if (item !== null) {
        playPlaylist(activePlaylist, item)
      }
      return
    }
    if (librarySection === "liked" && libraryAddTarget === null) {
      const item = selectedLibraryTrack()
      if (item !== null) {
        playMediaItem(item)
      }
      return
    }
    const playlist = selectedLibraryPlaylist()
    if (playlist === null) {
      return
    }
    if (libraryAddTarget !== null) {
      void discoveryController
        .addItemToPlaylist(libraryAddTarget, playlist)
        .then((succeeded) => {
          if (succeeded) {
            setLibraryAddTarget(null)
          }
        })
      return
    }
    setLibrarySelectedIndex(0)
    void discoveryController.openPlaylist(playlist)
  }, [
    discoveryController,
    discoveryState.library.activePlaylist,
    libraryAddTarget,
    librarySection,
    playMediaItem,
    playPlaylist,
    selectedLibraryPlaylist,
    selectedLibraryTrack,
  ])
  const playSelectedLibraryItem = useCallback(() => {
    const activePlaylist = discoveryState.library.activePlaylist
    if (activePlaylist !== null) {
      playPlaylist(
        activePlaylist,
        selectedLibraryTrack() ?? undefined,
      )
      return
    }
    if (librarySection === "playlists") {
      const playlist = selectedLibraryPlaylist()
      if (playlist !== null) {
        playPlaylist(playlist)
      }
      return
    }
    const item = selectedLibraryTrack()
    if (item !== null) {
      playMediaItem(item)
    }
  }, [
    discoveryState.library.activePlaylist,
    librarySection,
    playMediaItem,
    playPlaylist,
    selectedLibraryPlaylist,
    selectedLibraryTrack,
  ])
  const pageLibrary = useCallback(
    (direction: -1 | 1) => {
      if (discoveryState.library.activePlaylist !== null) {
        discoveryController.playlistPage(direction)
      } else {
        discoveryController.libraryPage(
          libraryAddTarget !== null ? "playlists" : librarySection,
          direction,
        )
      }
    },
    [
      discoveryController,
      discoveryState.library.activePlaylist,
      libraryAddTarget,
      librarySection,
    ],
  )
  const selectDeviceAt = useCallback((index: number) => {
    selectedDeviceIndexRef.current = index
    setSelectedDeviceIndex(index)
  }, [])
  const playerActions = useMemo<PlayerActions>(
    () => ({
      toggleShuffle: () => {
        playbackController.toggleShuffle()
      },
      previous: () => {
        playbackController.previous()
      },
      togglePlayback: () => {
        playbackController.togglePlayback()
      },
      next: () => {
        playbackController.next()
      },
      cycleRepeat: () => {
        playbackController.cycleRepeat()
      },
      seekTo: (positionMs) => {
        playbackController.seekTo(positionMs)
      },
      volumeDown: () => {
        playbackController.adjustVolume(-5)
      },
      toggleMute: () => {
        playbackController.toggleMute()
      },
      volumeUp: () => {
        playbackController.adjustVolume(5)
      },
      openDevices,
    }),
    [openDevices, playbackController],
  )

  const playerSurfaceEnabled =
    authState.status === "authenticated" &&
    activePage === "player" &&
    !settingsOpen &&
    !keybindsOpen

  return (
    <AppThemeProvider value={appTheme}>
      <UiAnimationProvider
        value={uiOptions.animations && terminalFocused}
      >
        <KeymapProvider keymap={keymap}>
        <GlobalCommandLayer
          router={router}
          quitEnabled={
            !interactionState.modalOpen &&
            !interactionState.textInputFocused
          }
        />
        <AuthCommandLayer
          action={authAction}
          onLogin={login}
          onRetry={retry}
        />
        <PlaybackCommandLayer
          controller={playbackController}
          enabled={playerSurfaceEnabled}
          onOpenDevices={openDevices}
        />
        <FocusCommandLayer
          controller={resolvedUiController}
          enabled={playerSurfaceEnabled}
        />
        <LyricsCommandLayer
          enabled={playerSurfaceEnabled}
          lyricsOpen={contextTab === "lyrics"}
          onToggle={toggleLyrics}
          onInfo={openInfoPanel}
          onScroll={scrollLyrics}
        />
        <SettingsCommandLayer
          enabled={authState.status === "authenticated" && !settingsOpen && !keybindsOpen}
          onOpen={openSettings}
        />
        <DiscoveryOpenCommandLayer
          enabled={authState.status === "authenticated" && !settingsOpen && !keybindsOpen}
          onSearch={openSearch}
          onBrowse={() => { navigateTo("browse") }}
          onQueue={openQueue}
          onLibrary={openLibrary}
        />
        <SearchCommandLayer
          enabled={activePage === "search" && !settingsOpen && !keybindsOpen}
          listFocused={!searchInputFocused}
          onInput={() => {
            setSearchInputFocused(true)
          }}
          onPrevious={() => {
            moveSearchSelection(-1)
          }}
          onNext={() => {
            moveSearchSelection(1)
          }}
          onPlay={() => {
            runSelectedSearchAction(queueMediaItem)
          }}
          onQueue={() => {
            runSelectedSearchAction(queueMediaItem)
          }}
          onLike={() => {
            runSelectedSearchAction(saveMediaItem)
          }}
          onPlaylist={() => {
            runSelectedSearchAction(addMediaToPlaylist)
          }}
          onOpenSpotify={() => {
            runSelectedSearchAction(openMediaItem)
          }}
          onPage={(direction) => {
            discoveryController.searchPage(direction)
          }}
        />
        <QueueCommandLayer
          enabled={activePage === "queue" && !settingsOpen && !keybindsOpen}
          onPrevious={() => {
            moveQueueSelection(-1)
          }}
          onNext={() => {
            moveQueueSelection(1)
          }}
          onPlay={playSelectedQueueItem}
        />
        <LibraryCommandLayer
          enabled={activePage === "library" && !settingsOpen && !keybindsOpen}
          onPrevious={() => {
            moveLibrarySelection(-1)
          }}
          onNext={() => {
            moveLibrarySelection(1)
          }}
          onSection={changeLibrarySection}
          onSelect={selectLibraryItem}
          onPlay={playSelectedLibraryItem}
          onQueue={() => {
            const item = selectedLibraryTrack()
            if (item !== null) {
              queueMediaItem(item)
            }
          }}
          onLike={() => {
            const item = selectedLibraryTrack()
            if (item !== null) {
              saveMediaItem(item)
            }
          }}
          onBack={() => {
            if (discoveryState.library.activePlaylist !== null) {
              discoveryController.closePlaylist()
              setLibrarySelectedIndex(0)
            }
          }}
          onReconnect={() => {
            setLibraryAddTarget(null)
            discoveryController.stop()
            authController.reauthorize()
          }}
          onPage={pageLibrary}
        />
        <SettingsModalCommandLayer
          enabled={settingsOpen}
          onPrevious={selectPreviousTheme}
          onNext={selectNextTheme}
          onApply={applySettings}
        />
        <DeviceCommandLayer
          enabled={activePage === "devices" && !settingsOpen && !keybindsOpen}
          onPrevious={selectPreviousDevice}
          onNext={selectNextDevice}
          onTransfer={transferToSelectedDevice}
        />
        {authState.status === "authenticated" ? (
          keybindsOpen ? (
            <KeybindsSurface
              {...dimensions}
              onClose={() => {
                setKeybindsOpen(false)
              }}
            />
          ) : settingsOpen ? (
            <SettingsSurface
              {...dimensions}
              selectedTheme={activeThemePreset}
              committedTheme={settingsCommittedTheme}
              saveStatus={settingsSaveStatus}
              onSelect={selectTheme}
              onApply={applySettings}
              onCancel={cancelSettings}
            />
          ) : activePage === "browse" ? (
            <BrowsePage {...dimensions} onSearch={openSearch} onNavigate={navigateTo} />
          ) : activePage === "devices" ? (
            <DeviceSurface
              {...dimensions}
              state={playbackState}
              selectedIndex={selectedDeviceIndex}
              onNavigate={navigateTo}
              onRefresh={() => { void playbackController.refresh() }}
              onSelect={selectDeviceAt}
              onTransfer={transferToDeviceAt}
          />
          ) : activePage === "search" ? (
            <SearchSurface
              {...dimensions}
              state={discoveryState.search}
              inputFocused={searchInputFocused}
              selectedIndex={searchSelectedIndex}
              notice={discoveryState.notice}
              onQuery={(query) => {
                discoveryController.setSearchQuery(query)
              }}
              onRetry={() => {
                discoveryController.setSearchQuery(discoveryState.search.query)
              }}
              onSelect={(index) => {
                searchSelectedIndexRef.current = index
                setSearchSelectedIndex(index)
                setSearchInputFocused(false)
              }}
              onQueue={queueMediaItem}
              onLike={saveMediaItem}
              onPlaylist={addMediaToPlaylist}
              onOpenSpotify={openMediaItem}
              onNavigate={navigateTo}
            />
          ) : activePage === "queue" ? (
            <QueueSurface
              {...dimensions}
              state={discoveryState.queue}
              selectedIndex={queueSelectedIndex}
              notice={discoveryState.notice}
              onSelect={(index) => {
                queueSelectedIndexRef.current = index
                setQueueSelectedIndex(index)
              }}
              onPlay={playMediaItem}
              onRefresh={() => {
                void discoveryController.refreshQueue()
              }}
              onNavigate={navigateTo}
            />
          ) : activePage === "library" ? (
            <LibrarySurface
              {...dimensions}
              state={discoveryState.library}
              section={
                libraryAddTarget === null
                  ? librarySection
                  : "playlists"
              }
              selectedIndex={librarySelectedIndex}
              notice={discoveryState.notice}
              addTarget={libraryAddTarget}
              onSection={(section) => {
                setLibrarySection(section)
                setLibrarySelectedIndex(0)
              }}
              onSelect={(index) => {
                librarySelectedIndexRef.current = index
                setLibrarySelectedIndex(index)
              }}
              onPlayItem={playMediaItem}
              onQueueItem={queueMediaItem}
              onLikeItem={saveMediaItem}
              onOpenPlaylist={(playlist) => {
                setLibrarySelectedIndex(0)
                void discoveryController.openPlaylist(playlist)
              }}
              onPlayPlaylist={playPlaylist}
              onChoosePlaylist={(playlist) => {
                if (libraryAddTarget !== null) {
                  void discoveryController
                    .addItemToPlaylist(libraryAddTarget, playlist)
                    .then((succeeded) => {
                      if (succeeded) {
                        setLibraryAddTarget(null)
                      }
                    })
                }
              }}
              onBack={() => {
                discoveryController.closePlaylist()
                setLibrarySelectedIndex(0)
              }}
              onReconnect={() => {
                setLibraryAddTarget(null)
                discoveryController.stop()
                authController.reauthorize()
              }}
              onNavigate={navigateTo}
            />
          ) : (
            <PlayerShell
              {...dimensions}
              state={playbackState}
              artworkController={artworkController}
              artworkEnabled={uiOptions.albumArt}
              animationsEnabled={uiOptions.animations}
              terminalFocused={terminalFocused}
              focusTarget={uiState.focusTarget}
              toasts={visibleToasts}
              actions={playerActions}
              activePage={activePage}
              onNavigate={navigateTo}
              onOpenSettings={openSettings}
              onOpenKeybinds={openKeybinds}
              contextTab={contextTab}
              lyrics={lyricsState}
              queue={discoveryState.queue}
              lyricsManualOffset={lyricsManualOffset}
            />
          )
        ) : (
          <AuthSurface
            {...dimensions}
            controller={authController}
            state={authState}
          />
        )}
        {authState.status === "authenticated" &&
        !settingsOpen &&
        activePage === "player" &&
        layoutMode === "compact" ? (
          <ToastHost
            toasts={visibleToasts}
            mode={layoutMode}
            terminalWidth={dimensions.width}
          />
        ) : null}
        </KeymapProvider>
      </UiAnimationProvider>
    </AppThemeProvider>
  )
}

function visibleFocusTargets(
  layoutMode: ReturnType<typeof resolveLayoutMode>,
  playbackReady: boolean,
): readonly UiFocusTarget[] {
  if (!playbackReady) {
    return layoutMode === "compact"
      ? ["transport"]
      : ["transport", "devices"]
  }
  return layoutMode === "compact"
    ? ["transport", "progress", "volume"]
    : ["transport", "progress", "volume", "devices"]
}

function noticeTone(kind: string): UiToastTone {
  return kind === "rate-limit" ||
    kind === "no-device" ||
    kind === "unsupported-volume"
    ? "warning"
    : "error"
}
