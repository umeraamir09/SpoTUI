import { useState } from "react"

import { useAppTheme } from "../theme/theme-context"

export interface PixelButtonProps {
  id: string
  label: string
  onPress: () => void
  active?: boolean
  primary?: boolean
  disabled?: boolean
  width?: number
  title?: string
}

export function PixelButton({
  id,
  label,
  onPress,
  active = false,
  primary = false,
  disabled = false,
  width = primary ? 7 : 5,
  title,
}: PixelButtonProps) {
  const theme = useAppTheme()
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const highlighted = active || hovered || pressed
  const foreground = disabled
    ? theme.colors.textMuted
    : primary
      ? theme.colors.background
      : highlighted
        ? theme.colors.accent
        : theme.colors.textPrimary
  const background = disabled
    ? theme.colors.surface
    : primary
      ? pressed
        ? theme.colors.accentSecondary
        : theme.colors.accent
      : highlighted
        ? theme.colors.surfaceRaised
        : theme.colors.surface

  return (
    <box
      id={id}
      height={3}
      width={width}
      border={theme.presentation.borders}
      {...(theme.presentation.borders
        ? {
            borderStyle: "single" as const,
            borderColor: disabled
              ? theme.colors.textMuted
              : highlighted || primary
                ? theme.colors.accent
                : theme.colors.border,
          }
        : {})}
      backgroundColor={background}
      alignItems="center"
      justifyContent="center"
      onMouseDown={(event) => {
        if (event.button !== 0 || disabled) {
          return
        }
        event.stopPropagation()
        setPressed(true)
        onPress()
      }}
      onMouseUp={(event) => {
        event.stopPropagation()
        setPressed(false)
      }}
      onMouseOver={() => {
        if (!disabled) {
          setHovered(true)
        }
      }}
      onMouseOut={() => {
        setHovered(false)
        setPressed(false)
      }}
    >
      <text fg={foreground}>
        <strong>{label}</strong>
      </text>
      {title === undefined ? null : (
        <text fg={theme.colors.textMuted}>{title}</text>
      )}
    </box>
  )
}
