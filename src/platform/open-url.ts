export type SupportedPlatform = "win32" | "darwin" | "linux"

export function getOpenUrlCommand(
  url: string,
  platform: NodeJS.Platform = process.platform,
): string[] {
  const parsed = new URL(url)
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only HTTP(S) URLs can be opened")
  }

  if (platform === "win32") {
    return ["rundll32", "url.dll,FileProtocolHandler", parsed.toString()]
  }

  if (platform === "darwin") {
    return ["open", parsed.toString()]
  }

  return ["xdg-open", parsed.toString()]
}

export async function openExternalUrl(url: string): Promise<void> {
  const command = getOpenUrlCommand(url)
  const processHandle = Bun.spawn(command, {
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  })
  const exitCode = await processHandle.exited
  if (exitCode !== 0) {
    throw new Error("The system browser could not be opened")
  }
}

