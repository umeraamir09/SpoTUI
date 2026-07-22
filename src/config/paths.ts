import { homedir } from "node:os"
import { join } from "node:path"

export interface PathEnvironment {
  readonly [name: string]: string | undefined
  APPDATA?: string
  XDG_CONFIG_HOME?: string
}

export function getConfigDirectory({
  environment = process.env,
  platform = process.platform,
  home = homedir(),
}: {
  environment?: PathEnvironment
  platform?: NodeJS.Platform
  home?: string
} = {}): string {
  if (platform === "win32") {
    return join(
      environment.APPDATA ?? join(home, "AppData", "Roaming"),
      "UmrooFM",
    )
  }

  if (platform === "darwin") {
    return join(home, "Library", "Application Support", "UmrooFM")
  }

  return join(
    environment.XDG_CONFIG_HOME ?? join(home, ".config"),
    "spotui",
  )
}

export function getConfigPath(options?: Parameters<
  typeof getConfigDirectory
>[0]): string {
  return join(getConfigDirectory(options), "config.toml")
}
