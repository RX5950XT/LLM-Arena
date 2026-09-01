import type { ProviderEndpoint } from './models'

export interface StoredAttachment {
  id: string
  type: 'image' | 'text'
  name: string
  mimeType: string
  content: string
  size: number
  isImagePlaceholder: boolean
}

export interface ArenaHistoryAttempt {
  responseText: string
  reasoningText?: string
  isStreaming?: boolean
  error: string | null
}

export interface ArenaHistoryEntry {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  slotCount: number
  repeatCount?: number
  slots: {
    id: string
    modelId: string
    systemPrompt: string
    reasoning: boolean
    responseText: string
    reasoningText?: string
    error: string | null
    attempts?: ArenaHistoryAttempt[]
  }[]
  userInput: string
  attachments: StoredAttachment[]
  judgeModelId: string
  judgeSystemPrompt: string
  judgeResult: string | null
  judgeReasoningText?: string
  isSending?: boolean
  isJudging?: boolean
}

export interface DebateHistoryEntry {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  topic: string
  totalRounds: number
  startingSide?: 'for' | 'against'
  forModel: { modelId: string; systemPrompt: string; reasoning?: boolean }
  againstModel: { modelId: string; systemPrompt: string; reasoning?: boolean }
  attachments: StoredAttachment[]
  messages: { side: 'for' | 'against'; round: number; content: string; reasoningText?: string }[]
  status?: 'idle' | 'debating' | 'judging' | 'completed'
  currentRound?: number
  currentSpeaker?: 'for' | 'against' | null
  currentStreamText?: string
  currentStreamReasoningText?: string
  judges: {
    name: string
    modelId: string
    systemPrompt: string
    analysis: string
    reasoningText?: string
    isStreaming?: boolean
    error?: string | null
  }[]
}

export interface ProviderHistoryResponse {
  responseText: string
  reasoningText?: string
  isStreaming?: boolean
  error: string | null
}

export interface ProviderHistoryEntry {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  modelId: string
  systemPrompt: string
  reasoning: boolean
  userInput: string
  attachments: StoredAttachment[]
  endpoints: ProviderEndpoint[]
  selectedSlugs: string[]
  responses: Record<string, ProviderHistoryResponse>
  isSending?: boolean
}

export interface HistoryExport {
  version: 1
  exportedAt: number
  arena: ArenaHistoryEntry[]
  debate: DebateHistoryEntry[]
  providers?: ProviderHistoryEntry[]
}
