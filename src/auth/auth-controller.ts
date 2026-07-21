import {
  AuthorizationCancelledError,
  AuthorizationDeniedError,
} from "./callback-server"
import {
  ReauthorizationRequiredError,
} from "./token-manager"
import {
  ConfigValidationError,
  validateSpotifyClientId,
  type ConfigStore,
} from "../config/config"

export interface AuthenticatedIdentity {
  accountId: string
  displayName: string | null
}

export interface AuthGateway {
  restore: (
    clientId: string,
    signal?: AbortSignal,
  ) => Promise<AuthenticatedIdentity | null>
  login: (
    clientId: string,
    signal?: AbortSignal,
    onCallbackReady?: (redirectUri: string) => void,
  ) => Promise<AuthenticatedIdentity>
  logout: () => Promise<void>
}

export type AuthErrorKind =
  | "authorization-denied"
  | "configuration"
  | "credential-store"
  | "network"

export type AuthViewState =
  | { status: "checking" }
  | {
      status: "needs-client-id"
      validationError: string | null
    }
  | {
      status: "ready"
      clientIdSource: "environment" | "config"
      notice: string | null
    }
  | {
      status: "authorizing"
      callbackUri: string | null
    }
  | {
      status: "authenticated"
      identity: AuthenticatedIdentity
    }
  | {
      status: "error"
      kind: AuthErrorKind
      message: string
      retryable: boolean
    }

export interface AuthControllerPort {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => AuthViewState
  initialize: () => void
  submitClientId: (clientId: string) => void
  login: () => void
  retry: () => void
  cancel: () => void
  logout: () => void
  reauthorize: () => void
  sessionExpired: () => void
  whenIdle: () => Promise<void>
}

export interface AuthControllerOptions {
  configStore: ConfigStore
  gateway: AuthGateway
  environment: Readonly<Record<string, string | undefined>>
}

export class AuthController implements AuthControllerPort {
  private readonly configStore: ConfigStore
  private readonly gateway: AuthGateway
  private readonly environment: Readonly<
    Record<string, string | undefined>
  >
  private readonly listeners = new Set<() => void>()

  private state: AuthViewState = { status: "checking" }
  private clientId: string | null = null
  private clientIdSource: "environment" | "config" = "config"
  private abortController: AbortController | null = null
  private pending: Promise<void> = Promise.resolve()
  private initializationStarted = false

  constructor({
    configStore,
    gateway,
    environment,
  }: AuthControllerOptions) {
    this.configStore = configStore
    this.gateway = gateway
    this.environment = environment
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): AuthViewState => this.state

  initialize(): void {
    if (this.initializationStarted) {
      return
    }
    this.initializationStarted = true
    this.schedule(async () => {
      this.setState({ status: "checking" })
      const environmentClientId =
        this.environment.SPOTIFY_CLIENT_ID?.trim()
      const configuredClientId =
        environmentClientId === undefined ||
        environmentClientId.length === 0
          ? await this.configStore.getClientId()
          : validateSpotifyClientId(environmentClientId)

      if (configuredClientId === null) {
        this.clientId = null
        this.setState({
          status: "needs-client-id",
          validationError: null,
        })
        return
      }

      this.clientId = configuredClientId
      this.clientIdSource =
        environmentClientId === undefined ||
        environmentClientId.length === 0
          ? "config"
          : "environment"

      try {
        const identity = await this.gateway.restore(configuredClientId)
        this.setState(
          identity === null
            ? this.readyState(null)
            : { status: "authenticated", identity },
        )
      } catch (error) {
        if (error instanceof ReauthorizationRequiredError) {
          this.setState(
            this.readyState(
              "Your Spotify session expired. Please authorize again.",
            ),
          )
          return
        }
        this.setError(error)
      }
    })
  }

  submitClientId(clientId: string): void {
    let validated: string
    try {
      validated = validateSpotifyClientId(clientId)
    } catch (error) {
      this.setState({
        status: "needs-client-id",
        validationError:
          error instanceof ConfigValidationError
            ? error.message
            : "Spotify Client ID is invalid",
      })
      this.pending = Promise.resolve()
      return
    }

    this.schedule(async () => {
      await this.configStore.setClientId(validated)
      this.clientId = validated
      this.clientIdSource = "config"
      this.setState(this.readyState(null))
    })
  }

  login(): void {
    this.beginAuthorization(false)
  }

  reauthorize(): void {
    this.beginAuthorization(true)
  }

  private beginAuthorization(clearSession: boolean): void {
    const clientId = this.clientId
    if (clientId === null) {
      this.setState({
        status: "needs-client-id",
        validationError: "Enter your Spotify Client ID first",
      })
      return
    }

    this.abortController?.abort()
    this.abortController = new AbortController()
    const signal = this.abortController.signal

    this.schedule(async () => {
      this.setState({
        status: "authorizing",
        callbackUri: null,
      })
      try {
        if (clearSession) {
          await this.gateway.logout()
        }
        const identity = await this.gateway.login(
          clientId,
          signal,
          (callbackUri) => {
            if (!signal.aborted) {
              this.setState({
                status: "authorizing",
                callbackUri,
              })
            }
          },
        )
        this.setState({ status: "authenticated", identity })
      } catch (error) {
        if (error instanceof AuthorizationCancelledError) {
          this.setState(
            this.readyState("Authorization was cancelled."),
          )
          return
        }
        this.setError(error)
      } finally {
        this.abortController = null
      }
    })
  }

  retry(): void {
    this.login()
  }

  cancel(): void {
    this.abortController?.abort()
  }

  logout(): void {
    this.schedule(async () => {
      await this.gateway.logout()
      this.setState(this.readyState("Signed out from Spotify."))
    })
  }

  sessionExpired(): void {
    this.abortController?.abort()
    if (this.clientId === null) {
      this.setState({
        status: "needs-client-id",
        validationError: null,
      })
      return
    }
    this.setState(
      this.readyState(
        "Your Spotify session expired. Please authorize again.",
      ),
    )
  }

  whenIdle(): Promise<void> {
    return this.pending
  }

  private schedule(action: () => Promise<void>): void {
    this.pending = action().catch((error: unknown) => {
      this.setError(error)
    })
  }

  private readyState(
    notice: string | null,
  ): Extract<AuthViewState, { status: "ready" }> {
    return {
      status: "ready",
      clientIdSource: this.clientIdSource,
      notice,
    }
  }

  private setError(error: unknown): void {
    if (
      error instanceof AuthorizationDeniedError ||
      (error instanceof Error && error.message === "access_denied")
    ) {
      this.setState({
        status: "error",
        kind: "authorization-denied",
        message:
          "Spotify authorization was denied. You can retry when ready.",
        retryable: true,
      })
      return
    }

    if (
      error instanceof ConfigValidationError ||
      (error instanceof Error &&
        error.name.startsWith("SecretStore"))
    ) {
      this.setState({
        status: "error",
        kind:
          error instanceof ConfigValidationError
            ? "configuration"
            : "credential-store",
        message:
          error instanceof ConfigValidationError
            ? error.message
            : "The operating-system credential store is unavailable.",
        retryable: true,
      })
      return
    }

    this.setState({
      status: "error",
      kind: "network",
      message:
        "Spotify could not be reached. Check your connection and retry.",
      retryable: true,
    })
  }

  private setState(state: AuthViewState): void {
    this.state = state
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export function createStaticAuthController(
  state: AuthViewState,
): AuthControllerPort {
  return {
    subscribe: () => () => void 0,
    getSnapshot: () => state,
    initialize: () => void 0,
    submitClientId: () => void 0,
    login: () => void 0,
    retry: () => void 0,
    cancel: () => void 0,
    logout: () => void 0,
    reauthorize: () => void 0,
    sessionExpired: () => void 0,
    whenIdle: () => Promise.resolve(),
  }
}
