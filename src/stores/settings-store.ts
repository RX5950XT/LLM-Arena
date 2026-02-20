import { create } from 'zustand'
import { DEFAULT_API_URL } from '@/constants/config'

const STORAGE_KEY = 'llm-arena-settings'

const DEFAULT_MODEL_LIST: string[] = [
  'google/gemini-3-flash-preview',
  'google/gemini-3.1-pro-preview',
  'moonshotai/kimi-k2.5',
  'z-ai/glm-5',
  'minimax/minimax-m2.5',
  'qwen/qwen3.5-397b-a17b',
  'deepseek/deepseek-v3.2'
]

interface SettingsState {
  apiUrl: string
  apiKey: string
  modelList: string[]
  isLoaded: boolean
  setApiUrl: (url: string) => void
  setApiKey: (key: string) => void
  addModel: (modelId: string) => void
  removeModel: (modelId: string) => void
  loadSettings: () => void
  saveSettings: () => void
}

function persistSettings(state: { apiUrl: string; apiKey: string; modelList: string[] }): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    apiUrl: state.apiUrl,
    apiKey: state.apiKey,
    modelList: state.modelList
  }))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiUrl: DEFAULT_API_URL,
  apiKey: '',
  modelList: DEFAULT_MODEL_LIST,
  isLoaded: false,

  setApiUrl: (apiUrl) => {
    set({ apiUrl })
    persistSettings({ ...get(), apiUrl })
  },
  setApiKey: (apiKey) => {
    set({ apiKey })
    persistSettings({ ...get(), apiKey })
  },

  addModel: (modelId) => {
    const trimmed = modelId.trim()
    if (!trimmed) return
    const { modelList } = get()
    if (modelList.includes(trimmed)) return
    const updated = [...modelList, trimmed]
    set({ modelList: updated })
    persistSettings({ ...get(), modelList: updated })
  },

  removeModel: (modelId) => {
    const updated = get().modelList.filter((m) => m !== modelId)
    set({ modelList: updated })
    persistSettings({ ...get(), modelList: updated })
  },

  loadSettings: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        set({
          apiUrl: parsed.apiUrl || DEFAULT_API_URL,
          apiKey: parsed.apiKey || '',
          modelList: Array.isArray(parsed.modelList) ? parsed.modelList : DEFAULT_MODEL_LIST,
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
    persistSettings(get())
  }
}))
