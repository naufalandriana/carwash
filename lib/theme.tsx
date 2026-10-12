'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'theme'
const DARK_CLASS = 'dark'

function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'dark') html.classList.add(DARK_CLASS)
  else html.classList.remove(DARK_CLASS)
  html.style.colorScheme = theme
  // sync meta theme-color for browser UI
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#10131a' : '#004ac6')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  // init from localStorage — default light, ignore system preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
      if (stored === 'dark' || stored === 'light') {
        setThemeState(stored)
        applyTheme(stored)
      } else {
        // default light, ensure no dark class
        applyTheme('light')
      }
    } catch {
      applyTheme('light')
    }
    setMounted(true)
    // enable smooth transitions after initial paint (no FOUC)
    const t = setTimeout(() => document.documentElement.classList.add('theme-transition'), 120)
    return () => clearTimeout(t)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    applyTheme(t)
  }, [])

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return next
    })
  }, [])

  // keep html class in sync if theme changes externally
  useEffect(() => {
    if (!mounted) return
    applyTheme(theme)
  }, [theme, mounted])

  const value = useMemo(() => ({ theme, toggle, setTheme, mounted }), [theme, toggle, setTheme, mounted])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
