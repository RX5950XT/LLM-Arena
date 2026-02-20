import { create } from 'zustand'
import { DEFAULT_API_URL } from '@/constants/config'

const STORAGE_KEY = 'llm-arena-settings'

interface SettingsState {
  apiUrl: string
  apiKey: string
  isLoaded: boolean
  setApiUrl: (url: string) => void
  setApiKey: (key: string) => void
  loadSettings: () => void
  saveSettings: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiUrl: DEFAULT_API_URL,
  apiKey: '',
  isLoaded: false,

  setApiUrl: (apiUrl) => {
    set({ apiUrl })
    const { apiKey } = get()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiUrl, apiKey }))
  },
  setApiKey: (apiKey) => {
    set({ apiKey })
    const { apiUrl } = get()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiUrl, apiKey }))
  },

  loadSettings: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        set({
          apiUrl: parsed.apiUrl || DEFAULT_API_URL,
          apiKey: parsed.apiKey || '',
          isLoaded: true
        })
      } else {
        set({ isLoaded: true })
      }
    } catch {
      set({ isLoaded: true })
    }
  },

  saveSettings: () => {
    const { apiUrl, apiKey } = get()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiUrl, apiKey }))
  }
}))
