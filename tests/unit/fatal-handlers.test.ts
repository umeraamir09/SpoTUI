import { describe, expect, mock, test } from "bun:test"

import { handleFatalError } from "../../src/app/fatal-handlers"

describe("fatal error handling", () => {
  test("cleans the renderer before reporting and marking the process failed", () => {
    const events: string[] = []
    const error = new Error("render failed")

    handleFatalError(error, {
      lifecycle: {
        closed: Promise.resolve(),
        shutdown: () => {
          events.push("cleanup")
        },
      },
      report: (reported) => {
        expect(reported).toBe(error)
        events.push("report")
      },
      markFailed: mock(() => {
        events.push("failed")
      }),
    })

    expect(events).toEqual(["cleanup", "report", "failed"])
  })
})
