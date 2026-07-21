import type { Binding } from "@opentui/keymap"
import { useBindings } from "@opentui/keymap/react"

import { COMMANDS } from "./commands"
import type { UiControllerPort } from "../ui/state/ui-controller"

export const FOCUS_BINDINGS = [
  { key: "tab", cmd: COMMANDS.focusNext },
  { key: "shift+tab", cmd: COMMANDS.focusPrevious },
] as const satisfies readonly Binding[]

export function FocusCommandLayer({
  controller,
  enabled,
}: {
  controller: UiControllerPort
  enabled: boolean
}): null {
  useBindings(
    () => ({
      priority: 6,
      commands: [
        {
          name: COMMANDS.focusNext,
          title: "Focus next player region",
          desc: "Move visible keyboard focus forward",
          run: () => {
            controller.focusNext()
          },
        },
        {
          name: COMMANDS.focusPrevious,
          title: "Focus previous player region",
          desc: "Move visible keyboard focus backward",
          run: () => {
            controller.focusPrevious()
          },
        },
      ],
      bindings: enabled ? FOCUS_BINDINGS : [],
    }),
    [controller, enabled],
  )
  return null
}
