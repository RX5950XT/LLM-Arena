import type { Attachment, ModelConfig } from './models'

export interface ArenaSlot extends ModelConfig {
  id: string
  attempts: ArenaAttempt[]
}

export interface ArenaAttempt {
  responseText: string
  reasoningText: string
  isStreaming: boolean
  error: string | null
}

export interface ArenaState {
  slots: ArenaSlot[]
  slotCount: number
  repeatCount: number
  userInput: string
  attachments: Attachment[]
  judgeModelId: string
  judgeSystemPrompt: string
  judgeResult: string | null
  judgeReasoningText: string
  isJudging: boolean
  isSending: boolean
}
