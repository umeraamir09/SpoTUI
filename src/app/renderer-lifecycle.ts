export interface RendererLifecycleTarget {
  destroy: () => void
  isDestroyed?: boolean
  on?: (event: "destroy", listener: () => void) => unknown
}

export interface RendererLifecycle {
  closed: Promise<void>
  shutdown: () => void
}

export function createRendererLifecycle(
  renderer?: RendererLifecycleTarget,
): RendererLifecycle {
  let resolveClosed: (() => void) | undefined
  let closed = false
  let shutdownStarted = false

  const closedPromise = new Promise<void>((resolve) => {
    resolveClosed = resolve
  })

  const markClosed = () => {
    if (closed) {
      return
    }

    closed = true
    resolveClosed?.()
  }

  renderer?.on?.("destroy", markClosed)

  return {
    closed: closedPromise,
    shutdown() {
      if (shutdownStarted) {
        return
      }

      shutdownStarted = true

      try {
        if (renderer && !renderer.isDestroyed) {
          renderer.destroy()
        }
      } finally {
        markClosed()
      }
    },
  }
}

