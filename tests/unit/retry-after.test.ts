import { describe, expect, test } from "bun:test"

import { parseRetryAfterMs } from "../../src/spotify/retry-after"

describe("Retry-After parsing", () => {
  test("parses delta seconds", () => {
    expect(parseRetryAfterMs("2", 10_000)).toBe(2_000)
    expect(parseRetryAfterMs("0.5", 10_000)).toBe(500)
  })

  test("parses an HTTP date relative to the supplied clock", () => {
    expect(
      parseRetryAfterMs(
        "Thu, 01 Jan 1970 00:00:12 GMT",
        10_000,
      ),
    ).toBe(2_000)
  })

  test("uses a bounded fallback for absent or invalid values", () => {
    expect(parseRetryAfterMs(null, 10_000)).toBe(1_000)
    expect(parseRetryAfterMs("not-a-date", 10_000)).toBe(1_000)
  })
})

