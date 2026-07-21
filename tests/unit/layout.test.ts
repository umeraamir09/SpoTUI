import { describe, expect, test } from "bun:test"

import {
  MIN_TERMINAL_HEIGHT,
  MIN_TERMINAL_WIDTH,
  resolveLayoutMode,
} from "../../src/ui/layout/layout"

describe("resolveLayoutMode", () => {
  test.each([
    [{ width: 140, height: 40 }, "large"],
    [{ width: 110, height: 30 }, "large"],
    [{ width: 109, height: 30 }, "medium"],
    [{ width: 90, height: 26 }, "medium"],
    [{ width: 76, height: 24 }, "medium"],
    [{ width: 75, height: 24 }, "compact"],
    [{ width: 72, height: 22 }, "compact"],
    [{ width: 52, height: 16 }, "compact"],
    [{ width: 51, height: 16 }, "too-small"],
    [{ width: 52, height: 15 }, "too-small"],
  ] as const)("maps %o to %s", (dimensions, expected) => {
    expect(resolveLayoutMode(dimensions)).toBe(expected)
  })

  test("exports the product minimum as an explicit boundary", () => {
    expect(MIN_TERMINAL_WIDTH).toBe(52)
    expect(MIN_TERMINAL_HEIGHT).toBe(16)
  })
})

