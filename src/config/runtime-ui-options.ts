export type RuntimeColorMode =
  | "auto"
  | "ansi256"
  | "monochrome"

export interface RuntimeUiOptions {
  albumArt: boolean
  animations: boolean
  asciiArtwork: boolean
  colorMode: RuntimeColorMode
  themeFile: string | null
  themePreset: string
  themePresetExplicit: boolean
}

export function parseRuntimeUiOptions(
  arguments_: readonly string[],
): RuntimeUiOptions {
  const asciiArtwork = arguments_.includes("--ascii")
  const themePreset = readOption(arguments_, "--theme")
  return {
    albumArt:
      !arguments_.includes("--no-art") && !asciiArtwork,
    animations: !arguments_.includes("--no-animations"),
    asciiArtwork,
    colorMode: arguments_.includes("--monochrome")
      ? "monochrome"
      : arguments_.includes("--256-color")
        ? "ansi256"
        : "auto",
    themeFile: readOption(arguments_, "--theme-file"),
    themePreset: themePreset ?? "warm-phosphor",
    themePresetExplicit: themePreset !== null,
  }
}

function readOption(
  arguments_: readonly string[],
  name: string,
): string | null {
  const prefix = `${name}=`
  const equalsValue = arguments_.find((argument) =>
    argument.startsWith(prefix),
  )
  if (equalsValue !== undefined) {
    return equalsValue.slice(prefix.length)
  }
  const index = arguments_.indexOf(name)
  return index >= 0 ? arguments_[index + 1] ?? null : null
}
