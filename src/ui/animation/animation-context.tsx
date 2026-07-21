import { createContext, useContext } from "react"

const UiAnimationContext = createContext(false)

export const UiAnimationProvider = UiAnimationContext.Provider

export function useUiAnimationActive(): boolean {
  return useContext(UiAnimationContext)
}
