import { useRef, useState } from "react"

import type {
  AuthControllerPort,
  AuthViewState,
} from "../../auth/auth-controller"
import { REDIRECT_REGISTRATION_URI } from "../../auth/constants"
import {
  resolveLayoutMode,
  type TerminalDimensions,
} from "../layout/layout"
import { useAppTheme } from "../theme/theme-context"
import { AppHeader } from "./AppHeader"
import { TooSmallState } from "./TooSmallState"

export interface AuthSurfaceProps extends TerminalDimensions {
  controller: AuthControllerPort
  state: Exclude<AuthViewState, { status: "authenticated" }>
}

export function AuthSurface({
  controller,
  state,
  ...dimensions
}: AuthSurfaceProps) {
  const theme = useAppTheme()
  const mode = resolveLayoutMode(dimensions)

  if (mode === "too-small") {
    return <TooSmallState {...dimensions} />
  }

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.colors.background}
    >
      <AppHeader mode={mode} />
      <box
        flexGrow={1}
        paddingX={mode === "compact" ? 1 : 3}
        paddingY={mode === "compact" ? 1 : 2}
        alignItems="center"
        justifyContent="center"
      >
        <box
          width={mode === "large" ? 78 : "100%"}
          maxWidth={78}
          border={theme.presentation.borders}
          {...(theme.presentation.borders
            ? { borderColor: theme.colors.border }
            : {})}
          backgroundColor={theme.colors.surface}
          flexDirection="column"
          paddingX={mode === "compact" ? 1 : 2}
          paddingY={1}
          gap={1}
        >
          <AuthStateContent controller={controller} state={state} />
        </box>
      </box>
      <AuthStatusBar state={state} />
    </box>
  )
}

function AuthStateContent({
  controller,
  state,
}: {
  controller: AuthControllerPort
  state: Exclude<AuthViewState, { status: "authenticated" }>
}) {
  const theme = useAppTheme()
  switch (state.status) {
    case "checking":
      return (
        <>
          <PanelHeading>CHECKING SPOTIFY SESSION</PanelHeading>
          <text fg={theme.colors.textSecondary}>
            Reading local configuration and the operating-system credential
            store...
          </text>
        </>
      )

    case "needs-client-id":
      return (
        <ClientIdForm
          controller={controller}
          validationError={state.validationError}
        />
      )

    case "ready":
      return (
        <>
          <PanelHeading>CONNECT YOUR SPOTIFY ACCOUNT</PanelHeading>
          <text fg={theme.colors.textPrimary}>
            Press Enter to authorize UmrooFM in your browser.
          </text>
          <text fg={theme.colors.textSecondary}>
            Register this redirect URI in your Spotify app:
          </text>
          <text fg={theme.colors.accent}>
            {REDIRECT_REGISTRATION_URI}
          </text>
          <text fg={theme.colors.textMuted}>
            Spotify permits the app to add a dynamic port to this loopback IP
            during authorization.
          </text>
          <text fg={theme.colors.textMuted}>
            Development Mode requires the app owner to have Spotify Premium
            and supports up to five allowlisted users.
          </text>
          {state.notice === null ? null : (
            <text fg={theme.colors.accentSecondary}>{state.notice}</text>
          )}
          <text fg={theme.colors.textMuted}>
            Client ID source: {state.clientIdSource}
          </text>
        </>
      )

    case "authorizing":
      return (
        <>
          <PanelHeading>WAITING FOR SPOTIFY</PanelHeading>
          <text fg={theme.colors.textPrimary}>
            Complete authorization in the browser window.
          </text>
          <text fg={theme.colors.textSecondary}>
            The callback listens only on 127.0.0.1 and closes when this attempt
            finishes.
          </text>
          {state.callbackUri === null ? (
            <text fg={theme.colors.textMuted}>
              Starting the loopback callback server...
            </text>
          ) : (
            <text fg={theme.colors.accent}>
              Active callback: {state.callbackUri}
            </text>
          )}
          <text fg={theme.colors.textMuted}>
            Press Esc to cancel this authorization attempt.
          </text>
        </>
      )

    case "error":
      return (
        <>
          <PanelHeading color={theme.colors.error}>
            SPOTIFY CONNECTION FAILED
          </PanelHeading>
          <text fg={theme.colors.textPrimary}>{state.message}</text>
          <text fg={theme.colors.textMuted}>
            {state.retryable
              ? "Press Enter to retry, or q to quit."
              : "Press q to quit."}
          </text>
        </>
      )
  }
}

function ClientIdForm({
  controller,
  validationError,
}: {
  controller: AuthControllerPort
  validationError: string | null
}) {
  const theme = useAppTheme()
  const [clientId, setClientId] = useState("")
  const clientIdRef = useRef(clientId)

  return (
    <>
      <PanelHeading>BRING YOUR OWN SPOTIFY CLIENT ID</PanelHeading>
      <text fg={theme.colors.textPrimary}>
        Create a Spotify app, then register this redirect URI:
      </text>
      <text fg={theme.colors.accent}>
        {REDIRECT_REGISTRATION_URI}
      </text>
      <text fg={theme.colors.textMuted}>
        Dashboard URI: no port. UmrooFM adds a dynamic port during login.
      </text>
      <text fg={theme.colors.textSecondary}>
        Paste the app&apos;s Client ID below. It is saved in your UmrooFM
        config; tokens are stored separately in the OS credential store.
      </text>
      <box
        border={theme.presentation.borders}
        {...(theme.presentation.borders
          ? {
              borderColor:
                validationError === null
                  ? theme.colors.accentSecondary
                  : theme.colors.error,
            }
          : {})}
        paddingX={1}
        height={3}
      >
        <input
          value={clientId}
          focused
          maxLength={128}
          placeholder="Spotify Client ID"
          placeholderColor={theme.colors.textMuted}
          backgroundColor={theme.colors.surfaceRaised}
          focusedBackgroundColor={theme.colors.surfaceRaised}
          textColor={theme.colors.textPrimary}
          focusedTextColor={theme.colors.textPrimary}
          onInput={(value) => {
            clientIdRef.current = value
            setClientId(value)
          }}
          onSubmit={() => {
            controller.submitClientId(clientIdRef.current)
          }}
        />
      </box>
      <text
        fg={
          validationError === null
            ? theme.colors.textMuted
            : theme.colors.error
        }
      >
        {validationError ?? "Press Enter to save the Client ID."}
      </text>
    </>
  )
}

function PanelHeading({
  children,
  color,
}: {
  children: string
  color?: string
}) {
  const theme = useAppTheme()
  return (
    <text fg={color ?? theme.colors.accentSecondary}>
      <strong>{children}</strong>
    </text>
  )
}

function AuthStatusBar({
  state,
}: {
  state: Exclude<AuthViewState, { status: "authenticated" }>
}) {
  const theme = useAppTheme()
  const detail =
    state.status === "needs-client-id"
      ? "input active / Enter save / Ctrl+C exit"
      : state.status === "authorizing"
        ? "browser authorization / Esc cancel / Ctrl+C exit"
        : "Enter continue / q quit / Ctrl+C exit"

  return (
    <box
      border={theme.presentation.borders ? ["top"] : false}
      {...(theme.presentation.borders
        ? { borderColor: theme.colors.border }
        : {})}
      height={3}
      paddingX={1}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <text fg={theme.colors.textSecondary}>{detail}</text>
      <text fg={theme.colors.spotify}>SPOTIFY WEB API REMOTE</text>
    </box>
  )
}
