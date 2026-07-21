import { describe, expect, mock, test } from "bun:test"

import { createCommandRouter } from "../../src/input/command-router"

describe("command router", () => {
  test("quits from the player surface", () => {
    const quit = mock(() => undefined)
    const router = createCommandRouter({
      getInteractionState: () => ({ modalOpen: false, textInputFocused: false }),
      closeModal: () => undefined,
      quit,
    })

    expect(router.dispatch("app.quit")).toEqual({ status: "handled" })
    expect(quit).toHaveBeenCalledTimes(1)
  })

  test.each([
    { modalOpen: true, textInputFocused: false },
    { modalOpen: false, textInputFocused: true },
  ])("blocks q when focus is owned by a modal or input: %o", (interactionState) => {
    const quit = mock(() => undefined)
    const router = createCommandRouter({
      getInteractionState: () => interactionState,
      closeModal: () => undefined,
      quit,
    })

    expect(router.dispatch("app.quit")).toEqual({
      status: "blocked",
      reason: "focus-owned",
    })
    expect(quit).not.toHaveBeenCalled()
  })

  test("Escape closes the active modal without quitting", () => {
    const closeModal = mock(() => undefined)
    const quit = mock(() => undefined)
    const router = createCommandRouter({
      getInteractionState: () => ({ modalOpen: true, textInputFocused: false }),
      closeModal,
      quit,
    })

    expect(router.dispatch("ui.escape")).toEqual({ status: "handled" })
    expect(closeModal).toHaveBeenCalledTimes(1)
    expect(quit).not.toHaveBeenCalled()
  })

  test("Escape is a safe no-op on the player surface", () => {
    const router = createCommandRouter({
      getInteractionState: () => ({ modalOpen: false, textInputFocused: false }),
      closeModal: () => undefined,
      quit: () => undefined,
    })

    expect(router.dispatch("ui.escape")).toEqual({ status: "ignored" })
  })

  test("rejects commands that have no Phase 0 handler", () => {
    const router = createCommandRouter({
      getInteractionState: () => ({ modalOpen: false, textInputFocused: false }),
      closeModal: () => undefined,
      quit: () => undefined,
    })

    expect(router.dispatch("player.toggle")).toEqual({
      status: "unavailable",
      command: "player.toggle",
    })
  })
})

