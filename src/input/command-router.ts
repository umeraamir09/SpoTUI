import type { AppCommand } from "./commands"

export interface InteractionState {
  modalOpen: boolean
  textInputFocused: boolean
}

export interface CommandRouterDependencies {
  getInteractionState: () => InteractionState
  closeModal: () => void
  quit: () => void
}

export type CommandDispatchResult =
  | { status: "handled" }
  | { status: "ignored" }
  | { status: "blocked"; reason: "focus-owned" }
  | { status: "unavailable"; command: AppCommand }

export interface CommandRouter {
  dispatch: (command: AppCommand) => CommandDispatchResult
}

export function createCommandRouter({
  getInteractionState,
  closeModal,
  quit,
}: CommandRouterDependencies): CommandRouter {
  return {
    dispatch(command) {
      const interaction = getInteractionState()

      switch (command) {
        case "app.quit": {
          if (interaction.modalOpen || interaction.textInputFocused) {
            return { status: "blocked", reason: "focus-owned" }
          }

          quit()
          return { status: "handled" }
        }

        case "ui.escape": {
          if (interaction.modalOpen) {
            closeModal()
            return { status: "handled" }
          }

          return { status: "ignored" }
        }

      }

      return { status: "unavailable", command }
    },
  }
}
