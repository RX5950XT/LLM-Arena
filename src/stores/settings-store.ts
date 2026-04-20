import { create } from 'zustand'
import { DEFAULT_API_URL } from '@/constants/config'

const STORAGE_KEY = 'llm-arena-settings'
const DEFAULT_TITLE_MODEL = 'qwen/qwen3-vl-8b-instruct'

const DEFAULT_MODEL_LIST: string[] = [
  'google/gemini-3-flash-preview',
  'google/gemini-3.1-pro-preview',
  'moonshotai/kimi-k2.5',
  'anthropic/claude-sonnet-4.6',
  'z-ai/glm-5.1',
  'minimax/minimax-m2.7',
  'qwen/qwen3.5-397b-a17b',
  'qwen/qwen3.6-plus',
  'x-ai/grok-4.20',
  'deepseek/deepseek-v3.2'
]

interface SettingsState {
  apiUrl: string
  apiKey: string
  modelList: string[]
  titleModelId: string
  isLoaded: boolean
  setApiUrl: (url: string) => void
  setApiKey: (key: string) => void
  setTitleModelId: (modelId: string) => void
  addModel: (modelId: string) => void
  removeModel: (modelId: string) => void
  loadSettings: () => void
  saveSettings: () => void
}

function persistSettings(state: { apiUrl: string; apiKey: string; modelList: string[]; titleModelId: string }): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    apiUrl: state.apiUrl,
    apiKey: state.apiKey,
    modelList: state.modelList,
    titleModelId: state.titleModelId
  }))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiUrl: DEFAULT_API_URL,
  apiKey: '',
  modelList: DEFAULT_MODEL_LIST,
  titleModelId: DEFAULT_TITLE_MODEL,
  isLoaded: false,

  setApiUrl: (apiUrl) => {
    set({ apiUrl })
    persistSettings({ ...get(), apiUrl })
  },
  setApiKey: (apiKey) => {
    set({ apiKey })
    persistSettings({ ...get(), apiKey })
  },
  setTitleModelId: (titleModelId) => {
    set({ titleModelId })
    persistSettings({ ...get(), titleModelId })
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
          titleModelId: parsed.titleModelId || DEFAULT_TITLE_MODEL,
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
