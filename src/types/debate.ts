import type { Attachment, ModelConfig } from './models'

export type DebateStatus = 'idle' | 'debating' | 'judging' | 'completed'
export type DebateSide = 'for' | 'against'

export interface DebateMessage {
  side: DebateSide
  round: number
  content: string
  reasoningText?: string
}

export interface JudgeResult {
  name: string
  modelId: string
  systemPrompt: string
  analysis: string
  reasoningText: string
  isStreaming: boolean
  error: string | null
}

export interface DebateState {
  topic: string
  totalRounds: number
  startingSide: DebateSide
  forModel: ModelConfig
  againstModel: ModelConfig
  attachments: Attachment[]
  status: DebateStatus
  currentRound: number
  currentSpeaker: DebateSide | null
  messages: DebateMessage[]
  currentStreamText: string
  currentStreamReasoningText: string
  judges: JudgeResult[]
}
