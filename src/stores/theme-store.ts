import { create } from 'zustand'

const THEME_KEY = 'llm-arena-theme'

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
    localStorage.setItem(THEME_KEY, theme)
  },
  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark'
    set({ theme: newTheme })
    applyTheme(newTheme)
    localStorage.setItem(THEME_KEY, newTheme)
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
    applyTheme('dark')
  }
}
