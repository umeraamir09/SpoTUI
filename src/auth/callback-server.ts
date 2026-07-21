import {
  OAuthStateMismatchError,
  validateOAuthState,
} from "./pkce"
import {
  LOOPBACK_CALLBACK_HOST,
  LOOPBACK_CALLBACK_PATH,
} from "./constants"

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1_000

const SUCCESS_PAGE = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>UmrooFM authorization complete</title>
<body style="font-family:system-ui;background:#0B0A08;color:#E8DCC8;padding:3rem">
<h1>Authorization complete</h1>
<p>You can close this tab and return to UmrooFM.</p>
</body>
</html>`

export class AuthorizationDeniedError extends Error {
  constructor(readonly reason: string) {
    super("Spotify authorization was denied")
    this.name = "AuthorizationDeniedError"
  }
}

export class AuthorizationCallbackError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthorizationCallbackError"
  }
}

export class AuthorizationCancelledError extends Error {
  constructor() {
    super("Spotify authorization was cancelled")
    this.name = "AuthorizationCancelledError"
  }
}

export interface AuthorizationCallback {
  code: string
}

export interface StartLoopbackCallbackOptions {
  expectedState: string
  timeoutMs?: number
  signal?: AbortSignal
}

export interface LoopbackCallbackSession {
  redirectUri: string
  result: Promise<AuthorizationCallback>
  close: () => Promise<void>
}

export type StartLoopbackCallback = (
  options: StartLoopbackCallbackOptions,
) => LoopbackCallbackSession

export function startLoopbackCallbackServer({
  expectedState,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
}: StartLoopbackCallbackOptions): LoopbackCallbackSession {
  let settled = false
  let resolveResult: ((value: AuthorizationCallback) => void) | undefined
  let rejectResult: ((reason: unknown) => void) | undefined
  let stopPromise: Promise<void> | null = null

  const result = new Promise<AuthorizationCallback>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })

  const server = Bun.serve({
    hostname: LOOPBACK_CALLBACK_HOST,
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      if (url.pathname !== LOOPBACK_CALLBACK_PATH) {
        return new Response("Not found", { status: 404 })
      }

      try {
        validateOAuthState(
          expectedState,
          url.searchParams.get("state"),
        )

        const denied = url.searchParams.get("error")
        if (denied !== null) {
          settleFailure(new AuthorizationDeniedError(denied))
          return new Response(
            "Authorization was not granted. Return to UmrooFM to retry.",
            { status: 400 },
          )
        }

        const code = url.searchParams.get("code")
        if (code === null || code.length === 0) {
          settleFailure(
            new AuthorizationCallbackError(
              "Spotify callback did not include an authorization code",
            ),
          )
          return new Response(
            "Authorization callback was incomplete. Return to UmrooFM to retry.",
            { status: 400 },
          )
        }

        settleSuccess({ code })
        return new Response(SUCCESS_PAGE, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      } catch (error) {
        const safeError =
          error instanceof OAuthStateMismatchError
            ? error
            : new AuthorizationCallbackError(
                "Spotify callback could not be processed",
              )
        settleFailure(safeError)
        return new Response(
          "Authorization validation failed. Return to UmrooFM to retry.",
          { status: 400 },
        )
      }
    },
  })

  const timeout = setTimeout(() => {
    settleFailure(
      new AuthorizationCallbackError("Spotify authorization timed out"),
    )
  }, timeoutMs)

  const stopServer = (): Promise<void> => {
    stopPromise ??= server.stop(true)
    return stopPromise
  }

  const cleanup = () => {
    clearTimeout(timeout)
    signal?.removeEventListener("abort", handleAbort)
  }

  function settleSuccess(value: AuthorizationCallback): void {
    if (settled) {
      return
    }
    settled = true
    resolveResult?.(value)
    cleanup()
  }

  function settleFailure(error: unknown): void {
    if (settled) {
      return
    }
    settled = true
    rejectResult?.(error)
    cleanup()
  }

  function handleAbort(): void {
    settleFailure(new AuthorizationCancelledError())
  }

  signal?.addEventListener("abort", handleAbort, { once: true })
  if (signal?.aborted === true) {
    handleAbort()
  }

  return {
    redirectUri:
      `http://${LOOPBACK_CALLBACK_HOST}:${String(server.port)}` +
      LOOPBACK_CALLBACK_PATH,
    result,
    async close() {
      if (!settled) {
        settleFailure(new AuthorizationCancelledError())
      }
      await stopServer()
    },
  }
}
