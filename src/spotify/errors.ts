export class SpotifyApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "SpotifyApiError"
  }
}

export class SpotifyRateLimitError extends SpotifyApiError {
  constructor(readonly retryAfterMs: number) {
    super(429, "Spotify rate limit reached")
    this.name = "SpotifyRateLimitError"
  }
}

export class SpotifyResponseValidationError extends Error {
  constructor() {
    super("Spotify returned an invalid response")
    this.name = "SpotifyResponseValidationError"
  }
}

