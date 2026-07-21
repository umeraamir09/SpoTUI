import {
  createContext,
  useContext,
  type ReactNode,
} from "react"

import { theme, type AppTheme } from "./theme"

const ThemeContext = createContext<AppTheme>(theme)

export function AppThemeProvider({
  children,
  value,
}: {
  children: ReactNode
  value: AppTheme
}) {
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext)
}
