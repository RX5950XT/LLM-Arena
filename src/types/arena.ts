import type { Attachment, ModelConfig } from './models'

export interface ArenaSlot extends ModelConfig {
  id: string
  responseText: string
  isStreaming: boolean
  error: string | null
}

export interface ArenaState {
  slots: ArenaSlot[]
  slotCount: number
  userInput: string
  attachments: Attachment[]
  judgeModelId: string
  judgeSystemPrompt: string
  judgeResult: string | null
  isJudging: boolean
  isSending: boolean
}
