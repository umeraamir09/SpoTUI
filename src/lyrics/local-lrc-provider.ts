import { join } from "node:path"

import { getConfigDirectory } from "../config/paths"
import { getLyricsCacheKey, parseLrc } from "./normalize"
import type { LyricsProvider, LyricsResult, LyricsTrackIdentity } from "./types"

export interface LocalLrcProviderOptions {
  directory?: string
}

export class LocalLrcProvider implements LyricsProvider {
  readonly id = "local-lrc"
  private readonly directory: string

  constructor({ directory = join(getConfigDirectory(), "lyrics") }: LocalLrcProviderOptions = {}) {
    this.directory = directory
  }

  async getLyrics(track: LyricsTrackIdentity): Promise<LyricsResult | null> {
    const names = [
      track.spotifyTrackId,
      getLyricsCacheKey(track),
    ].filter((name): name is string => name !== null && name.length > 0)
    for (const name of names) {
      const file = Bun.file(join(this.directory, `${name}.lrc`))
      if (!(await file.exists())) {
        continue
      }
      const source = await file.text()
      const lines = parseLrc(source)
      return lines.length > 0
        ? { kind: "synced", lines, source: "Local LRC" }
        : source.trim().length > 0
          ? { kind: "plain", text: source.trim(), source: "Local LRC" }
          : null
    }
    return null
  }
}
