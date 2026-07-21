import { describe, expect, mock, test } from "bun:test"

import { createRendererLifecycle } from "../../src/app/renderer-lifecycle"

describe("renderer lifecycle", () => {
  test("destroys the renderer exactly once across repeated shutdown paths", async () => {
    const destroy = mock(() => undefined)
    const lifecycle = createRendererLifecycle({ destroy })

    lifecycle.shutdown()
    lifecycle.shutdown()

    await lifecycle.closed
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  test("resolves when OpenTUI destroys itself after Ctrl+C", async () => {
    let onDestroy: (() => void) | undefined
    const destroy = mock(() => undefined)
    const lifecycle = createRendererLifecycle({
      destroy,
      on: (_event, listener) => {
        onDestroy = listener
      },
    })

    onDestroy?.()

    await lifecycle.closed
    expect(destroy).toHaveBeenCalledTimes(0)
  })

  test("cleanup remains safe when renderer initialization never completed", async () => {
    const lifecycle = createRendererLifecycle()

    lifecycle.shutdown()

    await lifecycle.closed
    expect(lifecycle.closed).toBeInstanceOf(Promise)
  })
})
