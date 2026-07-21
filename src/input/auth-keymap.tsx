import type { Binding } from "@opentui/keymap"
import { useBindings } from "@opentui/keymap/react"

import { COMMANDS } from "./commands"

export interface AuthCommandLayerProps {
  action: "login" | "retry" | null
  onLogin: () => void
  onRetry: () => void
}

const LOGIN_BINDINGS = [
  { key: "return", cmd: COMMANDS.authLogin },
] as const satisfies readonly Binding[]

const RETRY_BINDINGS = [
  { key: "return", cmd: COMMANDS.authRetry },
] as const satisfies readonly Binding[]

export function AuthCommandLayer({
  action,
  onLogin,
  onRetry,
}: AuthCommandLayerProps): null {
  useBindings(
    () => ({
      priority: 10,
      commands: [
        {
          name: COMMANDS.authLogin,
          title: "Authorize Spotify",
          desc: "Open Spotify authorization in the system browser",
          run: onLogin,
        },
        {
          name: COMMANDS.authRetry,
          title: "Retry authorization",
          desc: "Retry the Spotify authorization flow",
          run: onRetry,
        },
      ],
      bindings:
        action === "login"
          ? LOGIN_BINDINGS
          : action === "retry"
            ? RETRY_BINDINGS
            : [],
    }),
    [action, onLogin, onRetry],
  )

  return null
}
