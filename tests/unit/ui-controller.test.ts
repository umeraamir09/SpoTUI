import { describe, expect, test } from "bun:test"

import {
  UiController,
  type UiFocusTarget,
} from "../../src/ui/state/ui-controller"

describe("Phase 3 UI controller", () => {
  test("cycles visible focus through the active player regions", () => {
    const controller = new UiController()
    const targets: UiFocusTarget[] = [
      "transport",
      "progress",
      "volume",
      "devices",
    ]
    controller.setFocusTargets(targets)

    expect(controller.getSnapshot().focusTarget).toBe("transport")
    controller.focusNext()
    expect(controller.getSnapshot().focusTarget).toBe("progress")
    controller.focusPrevious()
    expect(controller.getSnapshot().focusTarget).toBe("transport")
    controller.focusPrevious()
    expect(controller.getSnapshot().focusTarget).toBe("devices")
  })

  test("keeps focus visible when a responsive layout removes a region", () => {
    const controller = new UiController()
    controller.setFocusTargets(["transport", "devices"])
    controller.focusPrevious()
    expect(controller.getSnapshot().focusTarget).toBe("devices")

    controller.setFocusTargets(["transport", "progress", "volume"])
    expect(controller.getSnapshot().focusTarget).toBe("transport")
  })

  test("deduplicates, bounds, and expires transient notifications", () => {
    const timers = new Map<number, () => void>()
    let nextTimer = 0
    const controller = new UiController({
      maxToasts: 2,
      setTimer: (callback) => {
        nextTimer += 1
        timers.set(nextTimer, callback)
        return nextTimer as unknown as ReturnType<typeof setTimeout>
      },
      clearTimer: (timer) => {
        timers.delete(timer as unknown as number)
      },
    })

    controller.showToast({
      key: "network",
      message: "Spotify signal lost",
      tone: "error",
    })
    controller.showToast({
      key: "network",
      message: "Spotify signal is stale",
      tone: "warning",
    })
    controller.showToast({
      key: "device",
      message: "Device transferred",
      tone: "success",
    })
    controller.showToast({
      key: "volume",
      message: "Volume updated",
      tone: "success",
    })

    expect(controller.getSnapshot().toasts).toHaveLength(2)
    expect(
      controller.getSnapshot().toasts.map((toast) => toast.key),
    ).toEqual(["device", "volume"])

    const latestTimer = Math.max(...timers.keys())
    timers.get(latestTimer)?.()
    expect(controller.getSnapshot().toasts).toHaveLength(1)
  })
})
