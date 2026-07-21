import type {
  AuthenticatedIdentity,
  AuthGateway,
} from "./auth-controller"
import {
  REQUIRED_SPOTIFY_SCOPES,
  type AuthService,
  type TokenEndpointClient,
} from "./auth-service"
import type { SecretStore } from "./secret-store"
import {
  ReauthorizationRequiredError,
  TokenManager,
  type AccessTokenOptions,
} from "./token-manager"
import type { FetchLike } from "../shared/http"
import { SpotifyClient } from "../spotify/client"

export interface SpotifyAuthGatewayOptions {
  authService: AuthService
  tokenClient: TokenEndpointClient
  secretStore: SecretStore
  fetch?: FetchLike
}

export class SpotifyAuthGateway implements AuthGateway {
  private readonly authService: AuthService
  private readonly tokenClient: TokenEndpointClient
  private readonly secretStore: SecretStore
  private readonly fetchImplementation: FetchLike
  private activeTokenManager: TokenManager | null = null
  private reauthorizationHandler: (() => void) | null = null

  constructor({
    authService,
    tokenClient,
    secretStore,
    fetch: fetchImplementation = fetch,
  }: SpotifyAuthGatewayOptions) {
    this.authService = authService
    this.tokenClient = tokenClient
    this.secretStore = secretStore
    this.fetchImplementation = fetchImplementation
  }

  async restore(
    clientId: string,
    signal?: AbortSignal,
  ): Promise<AuthenticatedIdentity | null> {
    const manager = this.createTokenManager(clientId)
    if (!(await manager.restore())) {
      return null
    }
    if (!manager.hasScopes(REQUIRED_SPOTIFY_SCOPES)) {
      await manager.clear()
      throw new ReauthorizationRequiredError()
    }

    const profile = await this.createClient(manager).getCurrentUserProfile(
      signal,
    )
    if (manager.getAccountId() !== profile.accountId) {
      await manager.clear()
      return null
    }

    this.activeTokenManager = manager
    return {
      accountId: profile.accountId,
      displayName: profile.displayName,
    }
  }

  async login(
    clientId: string,
    signal?: AbortSignal,
    onCallbackReady?: (redirectUri: string) => void,
  ): Promise<AuthenticatedIdentity> {
    const manager = this.createTokenManager(clientId)
    const grant = await this.authService.authorize(
      clientId,
      signal,
      onCallbackReady,
    )
    manager.acceptAuthorization(grant)
    const profile = await this.createClient(manager).getCurrentUserProfile(
      signal,
    )
    await manager.commitAccount(profile.accountId)
    this.activeTokenManager = manager

    return {
      accountId: profile.accountId,
      displayName: profile.displayName,
    }
  }

  async logout(): Promise<void> {
    if (this.activeTokenManager !== null) {
      await this.activeTokenManager.clear()
      this.activeTokenManager = null
      return
    }

    await this.secretStore.deleteSession()
  }

  async getAccessToken(
    options?: AccessTokenOptions,
  ): Promise<string> {
    if (this.activeTokenManager === null) {
      this.reauthorizationHandler?.()
      throw new ReauthorizationRequiredError()
    }
    try {
      return await this.activeTokenManager.getAccessToken(options)
    } catch (error) {
      if (error instanceof ReauthorizationRequiredError) {
        this.reauthorizationHandler?.()
      }
      throw error
    }
  }

  setReauthorizationHandler(handler: () => void): void {
    this.reauthorizationHandler = handler
  }

  private createTokenManager(clientId: string): TokenManager {
    return new TokenManager({
      clientId,
      secretStore: this.secretStore,
      refresh: (refreshClientId, refreshToken, signal) =>
        this.tokenClient.refreshAccessToken(
          refreshClientId,
          refreshToken,
          signal,
        ),
    })
  }

  private createClient(manager: TokenManager): SpotifyClient {
    return new SpotifyClient({
      tokenProvider: manager,
      fetch: this.fetchImplementation,
    })
  }
}
