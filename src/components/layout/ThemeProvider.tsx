import type { ReactNode } from 'react'
import { ThemeContext, useThemeProvider } from '@/hooks/useTheme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeValue = useThemeProvider()

  return (
    <ThemeContext.Provider value={themeValue}>
      <div
        className={`w-full h-full ${
          themeValue.isDark
            ? 'bg-slate-950 text-slate-100'
            : 'bg-slate-50 text-slate-800'
        }`}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
