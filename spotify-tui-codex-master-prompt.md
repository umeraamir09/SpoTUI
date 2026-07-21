# Codex Master Prompt — Retro Spotify TUI

Read `spotify-tui-plan.md` completely before making changes. Treat it as the product and architecture source of truth.

Build the application incrementally by its listed phases. Do not attempt to implement every phase in one unreviewed pass. For each phase:

1. inspect the current repository,
2. verify current OpenTUI and Spotify API documentation,
3. write or update tests first where practical,
4. implement the phase without leaking concerns across module boundaries,
5. run typecheck, lint, unit tests, integration tests, and relevant visual-frame tests,
6. fix all failures,
7. summarize changes and remaining risks.

Non-negotiable constraints:

- Use Bun, TypeScript, OpenTUI, OpenTUI React, and OpenTUI keymap.
- Use Spotify Authorization Code with PKCE and an explicit `127.0.0.1` loopback callback, never `localhost`.
- Use a bring-your-own Spotify Client ID workflow.
- Treat the app as a Spotify Connect/Web API remote controller, not an audio streaming client.
- Never scrape private Spotify endpoints.
- Never log access tokens, refresh tokens, authorization codes, or Authorization headers.
- Store secrets behind a `SecretStore` abstraction; prefer `Bun.secrets`.
- Use only current Spotify endpoints and account for the 2026 Development Mode changes.
- Respect 429 `Retry-After` responses.
- Render album artwork as the **entire circular vinyl face**, filling the disc edge to edge after masking; never reduce it to a center label. Render one subtle center dot, but do not overlay groove textures or render any spindle, spindle hole, center pin, or separate label disc.
- Lyrics must be optional and isolated behind a provider interface.
- Network, auth, domain state, command routing, and UI rendering must remain separate.
- The UI must support large, medium, compact, and too-small terminal states.
- Keyboard input must never be blocked by artwork or lyrics processing.
- Terminal cleanup must work after normal exit, Ctrl+C, exceptions, and failed initialization.
- Every phase must include meaningful automated tests.

Begin with Phase 0 only unless explicitly instructed otherwise.
