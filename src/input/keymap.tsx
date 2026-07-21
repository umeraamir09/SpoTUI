import type { Binding } from "@opentui/keymap"
import { useBindings } from "@opentui/keymap/react"

import type { CommandRouter } from "./command-router"
import { COMMANDS } from "./commands"

export const GLOBAL_BINDINGS = [
  { key: "q", cmd: COMMANDS.quit },
  { key: "escape", cmd: COMMANDS.escape },
] as const satisfies readonly Binding[]

export interface GlobalCommandLayerProps {
  router: CommandRouter
  quitEnabled: boolean
}

export function GlobalCommandLayer({
  router,
  quitEnabled,
}: GlobalCommandLayerProps): null {
  useBindings(
    () => ({
      priority: 0,
      commands: [
        {
          name: COMMANDS.quit,
          title: "Quit",
          desc: "Exit UmrooFM from the player surface",
          run: () => {
            router.dispatch(COMMANDS.quit)
          },
        },
        {
          name: COMMANDS.escape,
          title: "Back",
          desc: "Close the active surface and return to the player",
          run: () => {
            router.dispatch(COMMANDS.escape)
          },
        },
      ],
      bindings: quitEnabled
        ? GLOBAL_BINDINGS
        : GLOBAL_BINDINGS.filter(
            (binding) => binding.cmd !== COMMANDS.quit,
          ),
    }),
    [quitEnabled, router],
  )

  return null
}
