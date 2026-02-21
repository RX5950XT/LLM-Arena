import { create } from 'zustand'
import type { ArenaHistoryEntry, DebateHistoryEntry, HistoryExport } from '@/types/history'

const MAX_HISTORY = 50
const ARENA_KEY = 'llm-arena-history-arena'
const DEBATE_KEY = 'llm-arena-history-debate'

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
  activeArenaId: string | null
  activeDebateId: string | null
}

interface HistoryActions {
  loadHistory: () => void
  saveArena: (data: Omit<ArenaHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  deleteArena: (id: string) => void
  setActiveArenaId: (id: string | null) => void
  saveDebate: (data: Omit<DebateHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  deleteDebate: (id: string) => void
  setActiveDebateId: (id: string | null) => void
  exportHistory: () => HistoryExport
  importHistory: (data: HistoryExport) => void
}

export const useHistoryStore = create<HistoryState & HistoryActions>((set, get) => ({
  arenaHistory: [],
  debateHistory: [],
  activeArenaId: null,
  activeDebateId: null,

  loadHistory: () => {
    set({
      arenaHistory: loadFromStorage<ArenaHistoryEntry>(ARENA_KEY),
      debateHistory: loadFromStorage<DebateHistoryEntry>(DEBATE_KEY)
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

  exportHistory: () => ({
    version: 1,
    exportedAt: Date.now(),
    arena: get().arenaHistory,
    debate: get().debateHistory
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

    saveToStorage(ARENA_KEY, mergedArena)
    saveToStorage(DEBATE_KEY, mergedDebate)
    set({ arenaHistory: mergedArena, debateHistory: mergedDebate })
  }
}))
