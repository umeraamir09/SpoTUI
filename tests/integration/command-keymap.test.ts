import { describe, expect, test } from "bun:test"

import { GLOBAL_BINDINGS } from "../../src/input/keymap"

describe("global keymap definition", () => {
  test("routes quit and escape through named commands", () => {
    expect(GLOBAL_BINDINGS).toContainEqual({ key: "q", cmd: "app.quit" })
    expect(GLOBAL_BINDINGS).toContainEqual({ key: "escape", cmd: "ui.escape" })
  })

  test("does not bind playback concerns during Phase 0", () => {
    expect(GLOBAL_BINDINGS).toHaveLength(2)
  })
})

