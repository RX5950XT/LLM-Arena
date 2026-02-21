export interface StoredAttachment {
  id: string
  type: 'image' | 'text'
  name: string
  mimeType: string
  content: string
  size: number
  isImagePlaceholder: boolean
}

export interface ArenaHistoryEntry {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  slotCount: number
  slots: {
    id: string
    modelId: string
    systemPrompt: string
    reasoning: boolean
    responseText: string
    error: string | null
  }[]
  userInput: string
  attachments: StoredAttachment[]
  judgeModelId: string
  judgeSystemPrompt: string
  judgeResult: string | null
}

export interface DebateHistoryEntry {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  topic: string
  totalRounds: number
  forModel: { modelId: string; systemPrompt: string; reasoning?: boolean }
  againstModel: { modelId: string; systemPrompt: string; reasoning?: boolean }
  attachments: StoredAttachment[]
  messages: { side: 'for' | 'against'; round: number; content: string }[]
  judges: {
    name: string
    modelId: string
    systemPrompt: string
    analysis: string
  }[]
}

export interface HistoryExport {
  version: 1
  exportedAt: number
  arena: ArenaHistoryEntry[]
  debate: DebateHistoryEntry[]
}
