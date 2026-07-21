const PKCE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
const STATE_BYTE_LENGTH = 32

export class OAuthStateMismatchError extends Error {
  constructor() {
    super("OAuth callback state did not match")
    this.name = "OAuthStateMismatchError"
  }
}

function randomCharacters(length: number, alphabet: string): string {
  const values = crypto.getRandomValues(new Uint8Array(length))
  let output = ""

  for (const value of values) {
    output += alphabet.charAt(value % alphabet.length)
  }

  return output
}

function base64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
}

export function generateCodeVerifier(length = 64): string {
  if (length < 43 || length > 128) {
    throw new RangeError("PKCE verifier length must be between 43 and 128")
  }

  return randomCharacters(length, PKCE_ALPHABET)
}

export async function createCodeChallenge(
  verifier: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  )
  return base64Url(new Uint8Array(digest))
}

export function generateOAuthState(): string {
  const bytes = crypto.getRandomValues(
    new Uint8Array(STATE_BYTE_LENGTH),
  )
  return base64Url(bytes)
}

export function validateOAuthState(
  expected: string,
  actual: string | null,
): void {
  if (actual?.length !== expected.length) {
    throw new OAuthStateMismatchError()
  }

  let difference = 0
  for (let index = 0; index < expected.length; index += 1) {
    difference |=
      expected.charCodeAt(index) ^ actual.charCodeAt(index)
  }

  if (difference !== 0) {
    throw new OAuthStateMismatchError()
  }
}
