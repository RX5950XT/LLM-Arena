import { create } from 'zustand'

const THEME_KEY = 'llm-arena-theme'

function saveTheme(theme: 'dark' | 'light'): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch (error) {
    console.warn('主題偏好儲存失敗', error)
  }
}

interface ThemeState {
  theme: 'dark' | 'light'
  setTheme: (theme: 'dark' | 'light') => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  setTheme: (theme) => {
    set({ theme })
    applyTheme(theme)
    saveTheme(theme)
  },
  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark'
    set({ theme: newTheme })
    applyTheme(newTheme)
    saveTheme(newTheme)
  }
}))

function applyTheme(theme: 'dark' | 'light'): void {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function initTheme(): void {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') {
    useThemeStore.getState().setTheme(saved)
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    useThemeStore.setState({ theme: prefersDark ? 'dark' : 'light' })
    applyTheme(prefersDark ? 'dark' : 'light')
  }
}
