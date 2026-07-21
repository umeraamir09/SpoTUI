import {
  createStaticAuthController,
  type AuthControllerPort,
} from "../../src/auth/auth-controller"

export function createAuthenticatedAuthController(): AuthControllerPort {
  return createStaticAuthController({
    status: "authenticated",
    identity: {
      accountId: "account-test",
      displayName: "Test Listener",
    },
  })
}
