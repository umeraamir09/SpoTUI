import { z } from "zod"

import {
  startLoopbackCallbackServer,
  type StartLoopbackCallback,
} from "./callback-server"
import {
  createCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
} from "./pkce"
export { REDIRECT_REGISTRATION_URI } from "./constants"
import {
  OAuthTokenError,
  type TokenGrant,
} from "./token-manager"
import { openExternalUrl } from "../platform/open-url"
import type { FetchLike } from "../shared/http"
import { parseRetryAfterMs } from "../spotify/retry-after"

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize"
const TOKEN_URL = "https://accounts.spotify.com/api/token"

export const REQUIRED_SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-modify-playback-state",
  "user-read-private",
  "user-library-read",
  "user-library-modify",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
] as const

const oauthErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
})

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().default(""),
})

export interface TokenEndpointClient {
  exchangeAuthorizationCode: (
    clientId: string,
    code: string,
    redirectUri: string,
    verifier: string,
    signal?: AbortSignal,
  ) => Promise<TokenGrant>
  refreshAccessToken: (
    clientId: string,
    refreshToken: string,
    signal?: AbortSignal,
  ) => Promise<TokenGrant>
}

export interface SpotifyTokenClientOptions {
  fetch?: FetchLike
  delay?: (milliseconds: number, signal?: AbortSignal) => Promise<void>
  now?: () => number
}

function defaultDelay(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds)
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException("The operation was aborted", "AbortError"))
    }
    signal?.addEventListener("abort", abort, { once: true })
  })
}

export class SpotifyTokenClient implements TokenEndpointClient {
  private readonly fetchImplementation: FetchLike
  private readonly delay: (
    milliseconds: number,
    signal?: AbortSignal,
  ) => Promise<void>
  private readonly now: () => number

  constructor({
    fetch: fetchImplementation = fetch,
    delay = defaultDelay,
    now = Date.now,
  }: SpotifyTokenClientOptions = {}) {
    this.fetchImplementation = fetchImplementation
    this.delay = delay
    this.now = now
  }

  exchangeAuthorizationCode(
    clientId: string,
    code: string,
    redirectUri: string,
    verifier: string,
    signal?: AbortSignal,
  ): Promise<TokenGrant> {
    return this.requestToken(
      new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
      true,
      signal,
    )
  }

  refreshAccessToken(
    clientId: string,
    refreshToken: string,
    signal?: AbortSignal,
  ): Promise<TokenGrant> {
    return this.requestToken(
      new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      false,
      signal,
    )
  }

  private async requestToken(
    body: URLSearchParams,
    requireRefreshToken: boolean,
    signal?: AbortSignal,
    rateLimitRetried = false,
  ): Promise<TokenGrant> {
    const response = await this.fetchImplementation(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      ...(signal === undefined ? {} : { signal }),
    })

    if (response.status === 429 && !rateLimitRetried) {
      const delayMs = parseRetryAfterMs(
        response.headers.get("Retry-After"),
        this.now(),
      )
      await this.delay(delayMs, signal)
      return this.requestToken(body, requireRefreshToken, signal, true)
    }

    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const parsedError = oauthErrorSchema.safeParse(payload)
      throw new OAuthTokenError(
        parsedError.success ? parsedError.data.error : "token_error",
        parsedError.success
          ? (parsedError.data.error_description ??
              "Spotify token request failed")
          : "Spotify token request failed",
      )
    }

    const parsed = tokenResponseSchema.safeParse(payload)
    if (
      !parsed.success ||
      (requireRefreshToken && parsed.data.refresh_token === undefined)
    ) {
      throw new OAuthTokenError(
        "invalid_response",
        "Spotify returned an invalid token response",
      )
    }

    return {
      accessToken: parsed.data.access_token,
      tokenType: parsed.data.token_type,
      expiresInSeconds: parsed.data.expires_in,
      refreshToken: parsed.data.refresh_token ?? null,
      scope: parsed.data.scope,
    }
  }
}

export interface AuthServiceOptions {
  startCallback?: StartLoopbackCallback
  openUrl?: (url: string) => Promise<void>
  tokenClient: TokenEndpointClient
  createVerifier?: () => string
  createChallenge?: (verifier: string) => Promise<string>
  createState?: () => string
}

export class AuthService {
  private readonly startCallback: StartLoopbackCallback
  private readonly openUrl: (url: string) => Promise<void>
  private readonly tokenClient: TokenEndpointClient
  private readonly createVerifier: () => string
  private readonly createChallenge: (
    verifier: string,
  ) => Promise<string>
  private readonly createState: () => string

  constructor({
    startCallback = startLoopbackCallbackServer,
    openUrl = openExternalUrl,
    tokenClient,
    createVerifier = generateCodeVerifier,
    createChallenge = createCodeChallenge,
    createState = generateOAuthState,
  }: AuthServiceOptions) {
    this.startCallback = startCallback
    this.openUrl = openUrl
    this.tokenClient = tokenClient
    this.createVerifier = createVerifier
    this.createChallenge = createChallenge
    this.createState = createState
  }

  async authorize(
    clientId: string,
    signal?: AbortSignal,
    onCallbackReady?: (redirectUri: string) => void,
  ): Promise<TokenGrant> {
    const verifier = this.createVerifier()
    const [challenge, state] = await Promise.all([
      this.createChallenge(verifier),
      Promise.resolve(this.createState()),
    ])
    const callback = this.startCallback({
      expectedState: state,
      ...(signal === undefined ? {} : { signal }),
    })
    onCallbackReady?.(callback.redirectUri)

    try {
      const authorizationUrl = new URL(AUTHORIZE_URL)
      authorizationUrl.search = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: callback.redirectUri,
        state,
        scope: REQUIRED_SPOTIFY_SCOPES.join(" "),
        code_challenge_method: "S256",
        code_challenge: challenge,
      }).toString()

      await this.openUrl(authorizationUrl.toString())
      const { code } = await callback.result
      return await this.tokenClient.exchangeAuthorizationCode(
        clientId,
        code,
        callback.redirectUri,
        verifier,
        signal,
      )
    } finally {
      await callback.close()
    }
  }
}
