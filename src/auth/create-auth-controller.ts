import { AuthController } from "./auth-controller"
import {
  AuthService,
  SpotifyTokenClient,
} from "./auth-service"
import { BunSecretStore } from "./secret-store"
import { SpotifyAuthGateway } from "./spotify-auth-gateway"
import { ArtworkService } from "../artwork/artwork-service"
import {
  FileConfigStore,
  type ConfigStore,
} from "../config/config"
import {
  PlaybackController,
  type PlaybackControllerPort,
} from "../playback/playback-controller"
import {
  DiscoveryController,
  type DiscoveryControllerPort,
} from "../discovery/discovery-controller"
import { SpotifyClient } from "../spotify/client"
import { UiController } from "../ui/state/ui-controller"
import { LyricsController } from "../lyrics/lyrics-service"
import { LocalLrcProvider } from "../lyrics/local-lrc-provider"
import { LrcLibProvider } from "../lyrics/lrclib-provider"

export interface ApplicationControllers {
  authController: AuthController
  playbackController: PlaybackControllerPort
  discoveryController: DiscoveryControllerPort
  artworkController: ArtworkService
  uiController: UiController
  configStore: ConfigStore
  lyricsController: LyricsController
}

export function createAuthController(): AuthController {
  return createApplicationControllers().authController
}

export function createApplicationControllers(): ApplicationControllers {
  const configStore = new FileConfigStore()
  const secretStore = new BunSecretStore()
  const tokenClient = new SpotifyTokenClient()
  const authService = new AuthService({ tokenClient })
  const gateway = new SpotifyAuthGateway({
    authService,
    tokenClient,
    secretStore,
  })
  const spotifyClient = new SpotifyClient({
    tokenProvider: gateway,
  })

  const authController = new AuthController({
    configStore,
    gateway,
    environment: process.env,
  })
  gateway.setReauthorizationHandler(() => {
    authController.sessionExpired()
  })
  const playbackController = new PlaybackController({
    remote: spotifyClient,
  })

  return {
    authController,
    artworkController: new ArtworkService(),
    configStore,
    discoveryController: new DiscoveryController({
      remote: spotifyClient,
      onPlaybackChanged: () => {
        void playbackController.refresh()
      },
    }),
    playbackController,
    lyricsController: new LyricsController({
      providers: [new LocalLrcProvider(), new LrcLibProvider()],
    }),
    uiController: new UiController(),
  }
}
