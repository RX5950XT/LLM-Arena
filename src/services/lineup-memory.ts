import type { ModelConfig } from '@/types/models'

export interface ArenaLineup {
  repeatCount: number
  slots: Array<{ modelId: string; systemPrompt: string; reasoning: boolean }>
  judgeModelId: string
  judgeSystemPrompt: string
}

export interface DebateLineup {
  totalRounds: number
  startingSide: 'for' | 'against'
  forModel: ModelConfig
  againstModel: ModelConfig
  judges: Array<{ modelId: string; systemPrompt: string }>
}

const ARENA_KEY = 'llm-arena-last-lineup'
const DEBATE_KEY = 'llm-arena-last-debate-lineup'

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch (error) {
    console.warn('上次陣容讀取失敗', error)
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn('上次陣容儲存失敗', error)
  }
}

export function saveArenaLineup(lineup: ArenaLineup): void {
  write(ARENA_KEY, lineup)
}

export function loadArenaLineup(): ArenaLineup | null {
  const value = read(ARENA_KEY) as ArenaLineup | null
  return value && Array.isArray(value.slots) && value.slots.length > 0 ? value : null
}

export function saveDebateLineup(lineup: DebateLineup): void {
  write(DEBATE_KEY, lineup)
}

export function loadDebateLineup(): DebateLineup | null {
  const value = read(DEBATE_KEY) as DebateLineup | null
  return value && value.forModel && value.againstModel && Array.isArray(value.judges) ? value : null
}
