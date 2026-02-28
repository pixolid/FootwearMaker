import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  isDark: boolean
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  isDark: true,
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function useThemeProvider() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('footwearmaker-theme')
    return (stored as Theme) || 'dark'
  })

  const isDark = theme === 'dark'

  useEffect(() => {
    localStorage.setItem('footwearmaker-theme', theme)
    document.documentElement.classList.toggle('dark', isDark)
  }, [theme, isDark])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme, isDark }
}

// Scene colors based on theme
export const SCENE_COLORS = {
  dark: {
    background: 0x020617, // slate-950
    ground: 0x0f172a, // slate-900
    ambient: 0x334155, // slate-700
  },
  light: {
    background: 0xdbeafe, // blue-100
    ground: 0xf1f5f9, // slate-100
    ambient: 0xf8fafc, // slate-50
  },
} as const
