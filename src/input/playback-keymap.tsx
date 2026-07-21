import type { Binding } from "@opentui/keymap"
import { useBindings } from "@opentui/keymap/react"

import { COMMANDS } from "./commands"
import type { PlaybackControllerPort } from "../playback/playback-controller"

export const PLAYBACK_BINDINGS = [
  { key: " ", cmd: COMMANDS.playerToggle },
  { key: "n", cmd: COMMANDS.playerNext },
  { key: "p", cmd: COMMANDS.playerPrevious },
  { key: "h", cmd: COMMANDS.seekBackSmall },
  { key: "left", cmd: COMMANDS.seekBackSmall },
  { key: "l", cmd: COMMANDS.seekForwardSmall },
  { key: "right", cmd: COMMANDS.seekForwardSmall },
  { key: "shift+h", cmd: COMMANDS.seekBackLarge },
  { key: "shift+l", cmd: COMMANDS.seekForwardLarge },
  { key: "+", cmd: COMMANDS.volumeIncrease },
  { key: "=", cmd: COMMANDS.volumeIncrease },
  { key: "-", cmd: COMMANDS.volumeDecrease },
  { key: "m", cmd: COMMANDS.volumeMute },
  { key: "s", cmd: COMMANDS.playerShuffle },
  { key: "r", cmd: COMMANDS.playerRepeat },
  { key: "d", cmd: COMMANDS.deviceOpen },
] as const satisfies readonly Binding[]

export interface PlaybackCommandLayerProps {
  controller: PlaybackControllerPort
  enabled: boolean
  onOpenDevices: () => void
}

export function PlaybackCommandLayer({
  controller,
  enabled,
  onOpenDevices,
}: PlaybackCommandLayerProps): null {
  useBindings(
    () => ({
      priority: 5,
      commands: [
        command(COMMANDS.playerToggle, "Play / pause", () => {
          controller.togglePlayback()
        }),
        command(COMMANDS.playerNext, "Next track", () => {
          controller.next()
        }),
        command(COMMANDS.playerPrevious, "Previous track", () => {
          controller.previous()
        }),
        command(COMMANDS.seekBackSmall, "Seek back 5 seconds", () => {
          controller.seekBy(-5_000)
        }),
        command(
          COMMANDS.seekForwardSmall,
          "Seek forward 5 seconds",
          () => {
            controller.seekBy(5_000)
          },
        ),
        command(COMMANDS.seekBackLarge, "Seek back 30 seconds", () => {
          controller.seekBy(-30_000)
        }),
        command(
          COMMANDS.seekForwardLarge,
          "Seek forward 30 seconds",
          () => {
            controller.seekBy(30_000)
          },
        ),
        command(COMMANDS.volumeIncrease, "Increase volume", () => {
          controller.adjustVolume(5)
        }),
        command(COMMANDS.volumeDecrease, "Decrease volume", () => {
          controller.adjustVolume(-5)
        }),
        command(COMMANDS.volumeMute, "Mute / restore volume", () => {
          controller.toggleMute()
        }),
        command(COMMANDS.playerShuffle, "Toggle shuffle", () => {
          controller.toggleShuffle()
        }),
        command(COMMANDS.playerRepeat, "Cycle repeat mode", () => {
          controller.cycleRepeat()
        }),
        command(COMMANDS.deviceOpen, "Choose Spotify device", onOpenDevices),
      ],
      bindings: enabled ? PLAYBACK_BINDINGS : [],
    }),
    [controller, enabled, onOpenDevices],
  )

  return null
}

export const DEVICE_BINDINGS = [
  { key: "up", cmd: COMMANDS.devicePrevious },
  { key: "k", cmd: COMMANDS.devicePrevious },
  { key: "down", cmd: COMMANDS.deviceNext },
  { key: "j", cmd: COMMANDS.deviceNext },
  { key: "return", cmd: COMMANDS.deviceTransfer },
  { key: "shift+return", cmd: COMMANDS.deviceTransferAndPlay },
] as const satisfies readonly Binding[]

export interface DeviceCommandLayerProps {
  enabled: boolean
  onPrevious: () => void
  onNext: () => void
  onTransfer: (play: boolean) => void
}

export function DeviceCommandLayer({
  enabled,
  onPrevious,
  onNext,
  onTransfer,
}: DeviceCommandLayerProps): null {
  useBindings(
    () => ({
      priority: 20,
      commands: [
        command(COMMANDS.devicePrevious, "Previous device", onPrevious),
        command(COMMANDS.deviceNext, "Next device", onNext),
        command(COMMANDS.deviceTransfer, "Transfer playback", () => {
          onTransfer(false)
        }),
        command(
          COMMANDS.deviceTransferAndPlay,
          "Transfer and start playback",
          () => {
            onTransfer(true)
          },
        ),
      ],
      bindings: enabled ? DEVICE_BINDINGS : [],
    }),
    [enabled, onNext, onPrevious, onTransfer],
  )

  return null
}

function command(
  name: string,
  title: string,
  run: () => void,
) {
  return {
    name,
    title,
    desc: title,
    run,
  }
}
