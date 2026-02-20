import type { Attachment, ModelConfig } from './models'

export type DebateStatus = 'idle' | 'debating' | 'judging' | 'completed'
export type DebateSide = 'for' | 'against'

export interface DebateMessage {
  side: DebateSide
  round: number
  content: string
}

export interface JudgeResult {
  name: string
  modelId: string
  systemPrompt: string
  analysis: string
  isStreaming: boolean
  error: string | null
}

export interface DebateState {
  topic: string
  totalRounds: number
  forModel: ModelConfig
  againstModel: ModelConfig
  attachments: Attachment[]
  status: DebateStatus
  currentRound: number
  currentSpeaker: DebateSide | null
  messages: DebateMessage[]
  currentStreamText: string
  judges: JudgeResult[]
}
