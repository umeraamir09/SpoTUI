import { describe, expect, test } from "bun:test"

import { ArtworkCache } from "../../src/artwork/artwork-cache"

describe("artwork LRU cache", () => {
  test("bounds memory and refreshes recently used entries", () => {
    const cache = new ArtworkCache<string>(2)
    cache.set("first", "one")
    cache.set("second", "two")

    expect(cache.get("first")).toBe("one")
    cache.set("third", "three")

    expect(cache.get("first")).toBe("one")
    expect(cache.get("second")).toBeUndefined()
    expect(cache.get("third")).toBe("three")
    expect(cache.size).toBe(2)
  })

  test("rejects invalid capacities", () => {
    expect(() => new ArtworkCache(0)).toThrow(
      "Artwork cache capacity must be positive",
    )
  })

  test("evicts least-recently-used entries to stay within a byte budget", () => {
    const cache = new ArtworkCache<string>(5, {
      maxWeight: 6,
      weigh: (value) => value.length,
    })
    cache.set("first", "one")
    cache.set("second", "xx")
    expect(cache.get("first")).toBe("one")

    cache.set("third", "yyy")

    expect(cache.get("second")).toBeUndefined()
    expect(cache.get("first")).toBe("one")
    expect(cache.get("third")).toBe("yyy")
    expect(cache.weight).toBe(6)
  })
})
