import { describe, expect, test } from "bun:test"

import {
  createCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
  OAuthStateMismatchError,
  validateOAuthState,
} from "../../src/auth/pkce"

describe("PKCE", () => {
  test("matches the RFC 7636 S256 example", async () => {
    const verifier =
      "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

    const challenge = await createCodeChallenge(verifier)
    expect(challenge).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    )
  })

  test("generates a high-entropy verifier within Spotify's allowed alphabet", () => {
    const verifier = generateCodeVerifier()

    expect(verifier).toHaveLength(64)
    expect(verifier).toMatch(/^[A-Za-z0-9._~-]+$/)
  })

  test("generates a URL-safe OAuth state", () => {
    const state = generateOAuthState()

    expect(state.length).toBeGreaterThanOrEqual(32)
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  test("rejects a callback with the wrong state", () => {
    expect(() => validateOAuthState("expected", "different")).toThrow(
      OAuthStateMismatchError,
    )
  })
})
