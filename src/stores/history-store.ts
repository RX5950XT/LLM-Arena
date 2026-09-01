import { create } from 'zustand'
import type {
  ArenaHistoryEntry,
  DebateHistoryEntry,
  HistoryExport,
  ProviderHistoryEntry
} from '@/types/history'

const MAX_HISTORY = 50
const ARENA_KEY = 'llm-arena-history-arena'
const DEBATE_KEY = 'llm-arena-history-debate'
const PROVIDER_KEY = 'llm-arena-history-provider'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function loadFromStorage<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    return JSON.parse(raw) as T[]
  } catch {
    return []
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // localStorage 空間不足時靜默失敗
  }
}

function pruneToMax<T extends { updatedAt: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_HISTORY)
}

interface HistoryState {
  arenaHistory: ArenaHistoryEntry[]
  debateHistory: DebateHistoryEntry[]
  providerHistory: ProviderHistoryEntry[]
  activeArenaId: string | null
  activeDebateId: string | null
  activeProviderId: string | null
}

interface HistoryActions {
  loadHistory: () => void
  saveArena: (data: Omit<ArenaHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateArena: (id: string, data: Partial<ArenaHistoryEntry>) => void
  deleteArena: (id: string) => void
  setActiveArenaId: (id: string | null) => void
  saveDebate: (data: Omit<DebateHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateDebate: (id: string, data: Partial<DebateHistoryEntry>) => void
  deleteDebate: (id: string) => void
  setActiveDebateId: (id: string | null) => void
  saveProvider: (data: Omit<ProviderHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateProvider: (id: string, data: Partial<ProviderHistoryEntry>) => void
  deleteProvider: (id: string) => void
  setActiveProviderId: (id: string | null) => void
  exportHistory: () => HistoryExport
  importHistory: (data: HistoryExport) => void
}

export const useHistoryStore = create<HistoryState & HistoryActions>((set, get) => ({
  arenaHistory: [],
  debateHistory: [],
  providerHistory: [],
  activeArenaId: null,
  activeDebateId: null,
  activeProviderId: null,

  loadHistory: () => {
    set({
      arenaHistory: loadFromStorage<ArenaHistoryEntry>(ARENA_KEY),
      debateHistory: loadFromStorage<DebateHistoryEntry>(DEBATE_KEY),
      providerHistory: loadFromStorage<ProviderHistoryEntry>(PROVIDER_KEY)
    })
  },

  saveArena: (data) => {
    const { activeArenaId, arenaHistory } = get()
    const now = Date.now()
    let updated: ArenaHistoryEntry[]
    let newActiveId: string

    if (activeArenaId) {
      const exists = arenaHistory.some((e) => e.id === activeArenaId)
      if (exists) {
        updated = arenaHistory.map((e) =>
          e.id === activeArenaId ? { ...e, ...data, updatedAt: now } : e
        )
        newActiveId = activeArenaId
      } else {
        const newEntry: ArenaHistoryEntry = { id: generateId(), createdAt: now, updatedAt: now, ...data }
        updated = [newEntry, ...arenaHistory]
        newActiveId = newEntry.id
      }
    } else {
      const newEntry: ArenaHistoryEntry = { id: generateId(), createdAt: now, updatedAt: now, ...data }
      updated = [newEntry, ...arenaHistory]
      newActiveId = newEntry.id
    }

    const pruned = pruneToMax(updated)
    saveToStorage(ARENA_KEY, pruned)
    set({ arenaHistory: pruned, activeArenaId: newActiveId })
    return newActiveId
  },

  updateArena: (id, data) => {
    const updated = get().arenaHistory.map((entry) =>
      entry.id === id ? { ...entry, ...data, updatedAt: Date.now() } : entry
    )
    saveToStorage(ARENA_KEY, updated)
    set({ arenaHistory: updated })
  },

  deleteArena: (id) => {
    const updated = get().arenaHistory.filter((e) => e.id !== id)
    saveToStorage(ARENA_KEY, updated)
    set((state) => ({
      arenaHistory: updated,
      activeArenaId: state.activeArenaId === id ? null : state.activeArenaId
    }))
  },

  setActiveArenaId: (id) => set({ activeArenaId: id }),

  saveDebate: (data) => {
    const { activeDebateId, debateHistory } = get()
    const now = Date.now()
    let updated: DebateHistoryEntry[]
    let newActiveId: string

    if (activeDebateId) {
      const exists = debateHistory.some((e) => e.id === activeDebateId)
      if (exists) {
        updated = debateHistory.map((e) =>
          e.id === activeDebateId ? { ...e, ...data, updatedAt: now } : e
        )
        newActiveId = activeDebateId
      } else {
        const newEntry: DebateHistoryEntry = { id: generateId(), createdAt: now, updatedAt: now, ...data }
        updated = [newEntry, ...debateHistory]
        newActiveId = newEntry.id
      }
    } else {
      const newEntry: DebateHistoryEntry = { id: generateId(), createdAt: now, updatedAt: now, ...data }
      updated = [newEntry, ...debateHistory]
      newActiveId = newEntry.id
    }

    const pruned = pruneToMax(updated)
    saveToStorage(DEBATE_KEY, pruned)
    set({ debateHistory: pruned, activeDebateId: newActiveId })
    return newActiveId
  },

  updateDebate: (id, data) => {
    const updated = get().debateHistory.map((entry) =>
      entry.id === id ? { ...entry, ...data, updatedAt: Date.now() } : entry
    )
    saveToStorage(DEBATE_KEY, updated)
    set({ debateHistory: updated })
  },

  deleteDebate: (id) => {
    const updated = get().debateHistory.filter((e) => e.id !== id)
    saveToStorage(DEBATE_KEY, updated)
    set((state) => ({
      debateHistory: updated,
      activeDebateId: state.activeDebateId === id ? null : state.activeDebateId
    }))
  },

  setActiveDebateId: (id) => set({ activeDebateId: id }),

  saveProvider: (data) => {
    const { activeProviderId, providerHistory } = get()
    const now = Date.now()
    let updated: ProviderHistoryEntry[]
    let newActiveId: string

    if (activeProviderId && providerHistory.some((entry) => entry.id === activeProviderId)) {
      updated = providerHistory.map((entry) =>
        entry.id === activeProviderId ? { ...entry, ...data, updatedAt: now } : entry
      )
      newActiveId = activeProviderId
    } else {
      const newEntry: ProviderHistoryEntry = { id: generateId(), createdAt: now, updatedAt: now, ...data }
      updated = [newEntry, ...providerHistory]
      newActiveId = newEntry.id
    }

    const pruned = pruneToMax(updated)
    saveToStorage(PROVIDER_KEY, pruned)
    set({ providerHistory: pruned, activeProviderId: newActiveId })
    return newActiveId
  },

  updateProvider: (id, data) => {
    const updated = get().providerHistory.map((entry) =>
      entry.id === id ? { ...entry, ...data, updatedAt: Date.now() } : entry
    )
    saveToStorage(PROVIDER_KEY, updated)
    set({ providerHistory: updated })
  },

  deleteProvider: (id) => {
    const updated = get().providerHistory.filter((entry) => entry.id !== id)
    saveToStorage(PROVIDER_KEY, updated)
    set((state) => ({
      providerHistory: updated,
      activeProviderId: state.activeProviderId === id ? null : state.activeProviderId
    }))
  },

  setActiveProviderId: (id) => set({ activeProviderId: id }),

  exportHistory: () => ({
    version: 1,
    exportedAt: Date.now(),
    arena: get().arenaHistory,
    debate: get().debateHistory,
    providers: get().providerHistory
  }),

  importHistory: (data) => {
    if (data.version !== 1) return
    const { arenaHistory, debateHistory } = get()

    const existingArenaIds = new Set(arenaHistory.map((e) => e.id))
    const newArena = data.arena.filter((e) => !existingArenaIds.has(e.id))
    const mergedArena = pruneToMax([...arenaHistory, ...newArena])

    const existingDebateIds = new Set(debateHistory.map((e) => e.id))
    const newDebate = data.debate.filter((e) => !existingDebateIds.has(e.id))
    const mergedDebate = pruneToMax([...debateHistory, ...newDebate])

    const existingProviderIds = new Set(get().providerHistory.map((e) => e.id))
    const newProviders = (data.providers ?? []).filter((e) => !existingProviderIds.has(e.id))
    const mergedProviders = pruneToMax([...get().providerHistory, ...newProviders])

    saveToStorage(ARENA_KEY, mergedArena)
    saveToStorage(DEBATE_KEY, mergedDebate)
    saveToStorage(PROVIDER_KEY, mergedProviders)
    set({ arenaHistory: mergedArena, debateHistory: mergedDebate, providerHistory: mergedProviders })
  }
}))
