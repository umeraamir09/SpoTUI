import type { Binding } from "@opentui/keymap"
import { useBindings } from "@opentui/keymap/react"

import { COMMANDS } from "./commands"

export const SETTINGS_OPEN_BINDINGS = [
  { key: ",", cmd: COMMANDS.settingsOpen },
] as const satisfies readonly Binding[]

export const SETTINGS_MODAL_BINDINGS = [
  { key: "up", cmd: COMMANDS.settingsPrevious },
  { key: "k", cmd: COMMANDS.settingsPrevious },
  { key: "down", cmd: COMMANDS.settingsNext },
  { key: "j", cmd: COMMANDS.settingsNext },
  { key: "return", cmd: COMMANDS.settingsApply },
] as const satisfies readonly Binding[]

export function SettingsCommandLayer({
  enabled,
  onOpen,
}: {
  enabled: boolean
  onOpen: () => void
}): null {
  useBindings(
    () => ({
      priority: 5,
      commands: [
        {
          name: COMMANDS.settingsOpen,
          title: "Open settings",
          desc: "Choose the active UmrooFM theme",
          run: onOpen,
        },
      ],
      bindings: enabled ? SETTINGS_OPEN_BINDINGS : [],
    }),
    [enabled, onOpen],
  )
  return null
}

export function SettingsModalCommandLayer({
  enabled,
  onPrevious,
  onNext,
  onApply,
}: {
  enabled: boolean
  onPrevious: () => void
  onNext: () => void
  onApply: () => void
}): null {
  useBindings(
    () => ({
      priority: 20,
      commands: [
        command(
          COMMANDS.settingsPrevious,
          "Previous theme",
          onPrevious,
        ),
        command(COMMANDS.settingsNext, "Next theme", onNext),
        command(COMMANDS.settingsApply, "Apply theme", onApply),
      ],
      bindings: enabled ? SETTINGS_MODAL_BINDINGS : [],
    }),
    [enabled, onApply, onNext, onPrevious],
  )
  return null
}

function command(
  name: string,
  title: string,
  run: () => void,
) {
  return {
    name,
    title,
    desc: title,
    run,
  }
}
