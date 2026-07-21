import type { SecretStore } from "./secret-store"

const DEFAULT_EXPIRY_SKEW_MS = 30_000

export interface TokenGrant {
  accessToken: string
  tokenType: "Bearer"
  expiresInSeconds: number
  refreshToken: string | null
  scope: string
}

export interface AccessTokenOptions {
  forceRefresh?: boolean
  signal?: AbortSignal
}

export type RefreshToken = (
  clientId: string,
  refreshToken: string,
  signal?: AbortSignal,
) => Promise<TokenGrant>

export class OAuthTokenError extends Error {
  constructor(
    readonly code: string,
    description: string,
  ) {
    super(description)
    this.name = "OAuthTokenError"
  }
}

export class ReauthorizationRequiredError extends Error {
  constructor() {
    super("Spotify authorization must be renewed")
    this.name = "ReauthorizationRequiredError"
  }
}

export interface TokenManagerOptions {
  clientId: string
  secretStore: SecretStore
  refresh: RefreshToken
  now?: () => number
  expirySkewMs?: number
}

export class TokenManager {
  private readonly clientId: string
  private readonly secretStore: SecretStore
  private readonly refreshTokenRequest: RefreshToken
  private readonly now: () => number
  private readonly expirySkewMs: number

  private accessToken: string | null = null
  private refreshToken: string | null = null
  private accountId: string | null = null
  private authorizedAt: string | null = null
  private expiresAtMs = 0
  private grantedScopes = new Set<string>()
  private refreshInFlight: Promise<string> | null = null

  constructor({
    clientId,
    secretStore,
    refresh,
    now = Date.now,
    expirySkewMs = DEFAULT_EXPIRY_SKEW_MS,
  }: TokenManagerOptions) {
    this.clientId = clientId
    this.secretStore = secretStore
    this.refreshTokenRequest = refresh
    this.now = now
    this.expirySkewMs = expirySkewMs
  }

  async restore(): Promise<boolean> {
    const session = await this.secretStore.getSession()
    if (session === null) {
      return false
    }

    this.accountId = session.accountId
    this.refreshToken = session.refreshToken
    this.authorizedAt = session.authorizedAt
    await this.refreshAccessToken()
    return true
  }

  acceptAuthorization(grant: TokenGrant): void {
    if (grant.refreshToken === null) {
      throw new ReauthorizationRequiredError()
    }

    this.authorizedAt = new Date(this.now()).toISOString()
    this.applyGrant(grant)
  }

  async commitAccount(accountId: string): Promise<void> {
    if (this.refreshToken === null || this.authorizedAt === null) {
      throw new ReauthorizationRequiredError()
    }

    this.accountId = accountId
    await this.secretStore.setSession({
      accountId,
      refreshToken: this.refreshToken,
      authorizedAt: this.authorizedAt,
    })
  }

  async getAccessToken({
    forceRefresh = false,
    signal,
  }: AccessTokenOptions = {}): Promise<string> {
    const accessToken = this.accessToken
    const usable =
      accessToken !== null &&
      this.now() + this.expirySkewMs < this.expiresAtMs

    if (!forceRefresh && usable) {
      return accessToken
    }

    return this.refreshAccessToken(signal)
  }

  async clear(): Promise<void> {
    this.accessToken = null
    this.refreshToken = null
    this.accountId = null
    this.authorizedAt = null
    this.expiresAtMs = 0
    this.grantedScopes.clear()
    await this.secretStore.deleteSession()
  }

  getAccountId(): string | null {
    return this.accountId
  }

  hasScopes(requiredScopes: readonly string[]): boolean {
    return requiredScopes.every((scope) =>
      this.grantedScopes.has(scope),
    )
  }

  private refreshAccessToken(
    signal?: AbortSignal,
  ): Promise<string> {
    if (this.refreshInFlight !== null) {
      return this.refreshInFlight
    }

    const refreshToken = this.refreshToken
    if (refreshToken === null) {
      return Promise.reject(new ReauthorizationRequiredError())
    }

    this.refreshInFlight = this.performRefresh(
      refreshToken,
      signal,
    ).finally(() => {
      this.refreshInFlight = null
    })

    return this.refreshInFlight
  }

  private async performRefresh(
    existingRefreshToken: string,
    signal?: AbortSignal,
  ): Promise<string> {
    try {
      const grant = await this.refreshTokenRequest(
        this.clientId,
        existingRefreshToken,
        signal,
      )
      this.applyGrant(grant)

      if (
        grant.refreshToken !== null &&
        this.accountId !== null &&
        this.authorizedAt !== null
      ) {
        await this.secretStore.setSession({
          accountId: this.accountId,
          refreshToken: grant.refreshToken,
          authorizedAt: this.authorizedAt,
        })
      }

      return grant.accessToken
    } catch (error) {
      if (
        error instanceof OAuthTokenError &&
        error.code === "invalid_grant"
      ) {
        await this.clear()
        throw new ReauthorizationRequiredError()
      }

      throw error
    }
  }

  private applyGrant(grant: TokenGrant): void {
    this.accessToken = grant.accessToken
    this.grantedScopes = new Set(
      grant.scope.split(/\s+/u).filter((scope) => scope.length > 0),
    )
    this.expiresAtMs =
      this.now() + grant.expiresInSeconds * 1_000

    if (grant.refreshToken !== null) {
      this.refreshToken = grant.refreshToken
    }
  }
}
