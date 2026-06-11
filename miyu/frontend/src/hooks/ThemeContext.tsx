import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

const STORAGE_KEY = 'miyu_color_palette'

const defaultPalettes = [
  ['#8B5CF6', '#EC4899', '#3B82F6'],
  ['#F59E0B', '#EF4444', '#EC4899'],
  ['#10B981', '#06B6D4', '#3B82F6'],
  ['#F97316', '#EF4444', '#8B5CF6'],
  ['#6366F1', '#8B5CF6', '#EC4899'],
  ['#14B8A6', '#06B6D4', '#3B82F6'],
  ['#F43F5E', '#EC4899', '#8B5CF6'],
  ['#84CC16', '#22C55E', '#10B981'],
]

export interface ColorPalette {
  mode: 'auto' | 'custom'
  primary: string
  secondary: string
  tertiary: string
}

interface ThemeContextType {
  palette: ColorPalette
  setPalette: (palette: ColorPalette) => void
  setCustomPalette: (primary: string, secondary: string, tertiary: string) => void
  resetToAuto: () => void
  autoPalette: string[]
  defaultPalettes: string[][]
  getPalette: (username?: string) => string[]
}

const ThemeContext = createContext<ThemeContextType | null>(null)

function generateAutoPalette(username: string): string[] {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return defaultPalettes[Math.abs(hash) % defaultPalettes.length]
}

function getRandomUsername(): string {
  return 'user_' + Math.random().toString(36).substring(7)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<ColorPalette>({
    mode: 'auto',
    primary: '#8B5CF6',
    secondary: '#EC4899',
    tertiary: '#3B82F6',
  })
  const [autoUsername] = useState(() => getRandomUsername())

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ColorPalette
        if (parsed.mode && (parsed.mode === 'auto' || parsed.mode === 'custom')) {
          setPaletteState(parsed)
        }
      } catch {
        // ignore invalid stored data
      }
    }
  }, [])

  const setPalette = useCallback((newPalette: ColorPalette) => {
    setPaletteState(newPalette)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPalette))
  }, [])

  const setCustomPalette = useCallback(async (primary: string, secondary: string, tertiary: string) => {
    const newPalette: ColorPalette = {
      mode: 'custom',
      primary,
      secondary,
      tertiary,
    }
    setPaletteState(newPalette)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPalette))

    // Save to server
    try {
      const accessToken = localStorage.getItem('accessToken')
      if (accessToken) {
        await fetch('/api/user/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            palette_mode: 'custom',
            palette_primary: primary,
            palette_secondary: secondary,
            palette_tertiary: tertiary
          })
        })
      }
    } catch (error) {
      console.error('Failed to save palette to server:', error)
    }
  }, [])

  const resetToAuto = useCallback(async () => {
    const newPalette: ColorPalette = {
      mode: 'auto',
      primary: '#8B5CF6',
      secondary: '#EC4899',
      tertiary: '#3B82F6',
    }
    setPaletteState(newPalette)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPalette))

    // Save to server
    try {
      const accessToken = localStorage.getItem('accessToken')
      if (accessToken) {
        await fetch('/api/user/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            palette_mode: 'auto',
            palette_primary: null,
            palette_secondary: null,
            palette_tertiary: null
          })
        })
      }
    } catch (error) {
      console.error('Failed to save palette to server:', error)
    }
  }, [])

  const getPalette = useCallback((username?: string): string[] => {
    if (palette.mode === 'auto') {
      return generateAutoPalette(username || autoUsername)
    }
    return [palette.primary, palette.secondary, palette.tertiary]
  }, [palette, autoUsername])

  const value: ThemeContextType = {
    palette,
    setPalette,
    setCustomPalette,
    resetToAuto,
    autoPalette: generateAutoPalette(autoUsername),
    defaultPalettes,
    getPalette,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

export { defaultPalettes }