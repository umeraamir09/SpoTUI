import { describe, expect, test } from "bun:test"

import { buildMirroredSpectrum } from "../../src/ui/components/SpectrumVisualizer"

describe("mirrored spectrum visualizer", () => {
  test("builds equal upper and lower halves at the requested width", () => {
    const rows = buildMirroredSpectrum({
      trackKey: "track:signal",
      phase: 3,
      width: 34,
      height: 6,
      unicode: true,
    })

    expect(rows).toHaveLength(6)
    expect(rows.every((row) => row.length === 34)).toBe(true)
    expect(rows.slice(0, 3)).toEqual(rows.slice(3).reverse())
    expect(rows.join("")).toContain("▮")
  })

  test("changes with playback phase while remaining deterministic", () => {
    const options = {
      trackKey: "track:signal",
      width: 34,
      height: 2,
      unicode: true,
    } as const
    const first = buildMirroredSpectrum({ ...options, phase: 0 })
    const repeated = buildMirroredSpectrum({ ...options, phase: 0 })
    const advanced = buildMirroredSpectrum({ ...options, phase: 4 })

    expect(repeated).toEqual(first)
    expect(advanced).not.toEqual(first)
  })

  test("uses only ASCII bars when Unicode presentation is disabled", () => {
    const rows = buildMirroredSpectrum({
      trackKey: "track:ascii",
      phase: 2,
      width: 20,
      height: 4,
      unicode: false,
    })

    expect(rows.join("")).toMatch(/^[| ]+$/)
  })
})
