import { create } from 'zustand'
import { DEFAULT_API_URL } from '@/constants/config'
import type { SystemPrompt } from '@/types/models'

const STORAGE_KEY = 'llm-arena-settings'
const DEFAULT_TITLE_MODEL = 'openrouter/free'
const DEFAULT_SYSTEM_PROMPTS: SystemPrompt[] = []

const DEFAULT_MODEL_LIST: string[] = [
  'moonshotai/kimi-k2.6',
  'deepseek/deepseek-v4-flash-0731',
  'z-ai/glm-5.3',
  'z-ai/glm-5.3-flash',
  'qwen/qwen3.8-27b',
  'openai/gpt-5.6-luna'
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseSystemPrompts(value: unknown): SystemPrompt[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    const content = typeof entry.content === 'string' ? entry.content.trim() : ''
    return id && name && content ? [{ id, name, content }] : []
  })
}

interface SettingsState {
  apiUrl: string
  apiKey: string
  modelList: string[]
  systemPrompts: SystemPrompt[]
  titleModelId: string
  isLoaded: boolean
  setApiUrl: (url: string) => void
  setApiKey: (key: string) => void
  setTitleModelId: (modelId: string) => void
  addModel: (modelId: string) => void
  removeModel: (modelId: string) => void
  addSystemPrompts: (prompts: SystemPrompt[]) => number
  removeSystemPrompt: (id: string) => void
  loadSettings: () => void
  saveSettings: () => void
}

function persistSettings(state: { apiUrl: string; apiKey: string; modelList: string[]; systemPrompts: SystemPrompt[]; titleModelId: string }): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    apiUrl: state.apiUrl,
    apiKey: state.apiKey,
    modelList: state.modelList,
    systemPrompts: state.systemPrompts,
    titleModelId: state.titleModelId
  }))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiUrl: DEFAULT_API_URL,
  apiKey: '',
  modelList: DEFAULT_MODEL_LIST,
  systemPrompts: DEFAULT_SYSTEM_PROMPTS,
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

  addSystemPrompts: (prompts) => {
    const current = get().systemPrompts
    const existing = new Set(current.map((prompt) => `${prompt.name}\u0000${prompt.content}`))
    const additions = prompts
      .map((prompt) => ({
        ...prompt,
        name: prompt.name.trim(),
        content: prompt.content.trim()
      }))
      .filter((prompt) => prompt.id && prompt.name && prompt.content)
      .filter((prompt) => {
        const key = `${prompt.name}\u0000${prompt.content}`
        if (existing.has(key)) return false
        existing.add(key)
        return true
      })
    if (additions.length === 0) return 0

    const updated = [...current, ...additions]
    set({ systemPrompts: updated })
    persistSettings({ ...get(), systemPrompts: updated })
    return additions.length
  },

  removeSystemPrompt: (id) => {
    const updated = get().systemPrompts.filter((prompt) => prompt.id !== id)
    set({ systemPrompts: updated })
    persistSettings({ ...get(), systemPrompts: updated })
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
          systemPrompts: parseSystemPrompts(parsed.systemPrompts),
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
