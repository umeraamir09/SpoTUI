import { describe, expect, mock, test } from "bun:test"

import {
  AuthController,
  type AuthGateway,
} from "../../src/auth/auth-controller"
import { MemoryConfigStore } from "../../src/config/config"

const IDENTITY = {
  accountId: "account-stable",
  displayName: "Listener",
} as const

describe("AuthController", () => {
  test("starts in first-run state when no Client ID is configured", async () => {
    const controller = new AuthController({
      configStore: new MemoryConfigStore(),
      gateway: createGateway(),
      environment: {},
    })

    controller.initialize()
    await controller.whenIdle()

    expect(controller.getSnapshot()).toEqual({
      status: "needs-client-id",
      validationError: null,
    })
  })

  test("saves a BYO Client ID and exposes a login-ready state", async () => {
    const configStore = new MemoryConfigStore()
    const controller = new AuthController({
      configStore,
      gateway: createGateway(),
      environment: {},
    })

    controller.submitClientId("abc123client")
    await controller.whenIdle()

    expect(await configStore.getClientId()).toBe("abc123client")
    expect(controller.getSnapshot().status).toBe("ready")
  })

  test("restores a persisted session without exposing credentials in UI state", async () => {
    const controller = new AuthController({
      configStore: new MemoryConfigStore("abc123client"),
      gateway: createGateway({ restore: () => Promise.resolve(IDENTITY) }),
      environment: {},
    })

    controller.initialize()
    await controller.whenIdle()

    const state = controller.getSnapshot()
    expect(state).toEqual({ status: "authenticated", identity: IDENTITY })
    expect(JSON.stringify(state)).not.toMatch(/token|authorization/i)
  })

  test("restores a saved session only once when initialization is repeated", async () => {
    const restore = mock(() => Promise.resolve(IDENTITY))
    const controller = new AuthController({
      configStore: new MemoryConfigStore("abc123client"),
      gateway: createGateway({ restore }),
      environment: {},
    })

    controller.initialize()
    await controller.whenIdle()
    controller.initialize()
    await controller.whenIdle()

    expect(restore).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot()).toEqual({
      status: "authenticated",
      identity: IDENTITY,
    })
  })

  test("maps an authorization denial to a clear retry state", async () => {
    const controller = new AuthController({
      configStore: new MemoryConfigStore("abc123client"),
      gateway: createGateway({
        login: () => Promise.reject(new Error("access_denied")),
      }),
      environment: {},
    })

    controller.initialize()
    await controller.whenIdle()
    controller.login()
    await controller.whenIdle()

    expect(controller.getSnapshot()).toEqual({
      status: "error",
      kind: "authorization-denied",
      message: "Spotify authorization was denied. You can retry when ready.",
      retryable: true,
    })
  })

  test("returns to login when a running API session expires", async () => {
    const controller = new AuthController({
      configStore: new MemoryConfigStore("abc123client"),
      gateway: createGateway({
        restore: () => Promise.resolve(IDENTITY),
      }),
      environment: {},
    })
    controller.initialize()
    await controller.whenIdle()

    controller.sessionExpired()

    expect(controller.getSnapshot()).toEqual({
      status: "ready",
      clientIdSource: "config",
      notice: "Your Spotify session expired. Please authorize again.",
    })
  })

  test("clears an old session before requesting expanded permissions", async () => {
    const logout = mock(() => Promise.resolve())
    const login = mock(() => Promise.resolve(IDENTITY))
    const controller = new AuthController({
      configStore: new MemoryConfigStore("abc123client"),
      gateway: createGateway({ logout, login }),
      environment: {},
    })
    controller.initialize()
    await controller.whenIdle()

    controller.reauthorize()
    await controller.whenIdle()

    expect(logout).toHaveBeenCalledTimes(1)
    expect(login).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot()).toEqual({
      status: "authenticated",
      identity: IDENTITY,
    })
  })
})

function createGateway(
  overrides: Partial<AuthGateway> = {},
): AuthGateway {
  return {
    restore: () => Promise.resolve(null),
    login: () => Promise.resolve(IDENTITY),
    logout: () => Promise.resolve(),
    ...overrides,
  }
}
