import { create } from 'zustand'
import type { DebateMessage, DebateStatus, DebateSide, JudgeResult } from '@/types/debate'
import type { Attachment, ModelConfig } from '@/types/models'
import {
  DEFAULT_FOR_PROMPT,
  DEFAULT_AGAINST_PROMPT,
  DEBATE_JUDGE_DEFAULTS
} from '@/constants/default-prompts'
import { DEFAULT_DEBATE_ROUNDS } from '@/constants/config'

interface DebateActions {
  setTopic: (topic: string) => void
  setTotalRounds: (rounds: number) => void
  setForModel: (config: Partial<ModelConfig>) => void
  setAgainstModel: (config: Partial<ModelConfig>) => void
  addAttachment: (attachment: Attachment) => void
  removeAttachment: (id: string) => void
  setStatus: (status: DebateStatus) => void
  setCurrentRound: (round: number) => void
  setCurrentSpeaker: (speaker: DebateSide | null) => void
  appendMessage: (message: DebateMessage) => void
  setCurrentStreamText: (text: string) => void
  appendStreamToken: (token: string) => void
  updateJudge: (index: number, updates: Partial<JudgeResult>) => void
  setJudgeResult: (index: number, analysis: string) => void
  appendJudgeToken: (index: number, token: string) => void
  reset: () => void
  resetDebate: () => void
}

interface DebateStore {
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

const defaultJudges: JudgeResult[] = DEBATE_JUDGE_DEFAULTS.map((j) => ({
  name: j.name,
  modelId: '',
  systemPrompt: j.systemPrompt,
  analysis: '',
  isStreaming: false,
  error: null
}))

export const useDebateStore = create<DebateStore & DebateActions>((set, get) => ({
  topic: '',
  totalRounds: DEFAULT_DEBATE_ROUNDS,
  forModel: { modelId: '', systemPrompt: DEFAULT_FOR_PROMPT },
  againstModel: { modelId: '', systemPrompt: DEFAULT_AGAINST_PROMPT },
  attachments: [],
  status: 'idle',
  currentRound: 0,
  currentSpeaker: null,
  messages: [],
  currentStreamText: '',
  judges: defaultJudges.map((j) => ({ ...j })),

  setTopic: (topic) => set({ topic }),
  setTotalRounds: (totalRounds) => set({ totalRounds }),

  setForModel: (config) =>
    set((state) => ({ forModel: { ...state.forModel, ...config } })),

  setAgainstModel: (config) =>
    set((state) => ({ againstModel: { ...state.againstModel, ...config } })),

  addAttachment: (attachment) =>
    set((state) => ({ attachments: [...state.attachments, attachment] })),

  removeAttachment: (id) =>
    set((state) => ({
      attachments: state.attachments.filter((a) => a.id !== id)
    })),

  setStatus: (status) => set({ status }),
  setCurrentRound: (currentRound) => set({ currentRound }),
  setCurrentSpeaker: (currentSpeaker) => set({ currentSpeaker }),

  appendMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
      currentStreamText: ''
    })),

  setCurrentStreamText: (currentStreamText) => set({ currentStreamText }),

  appendStreamToken: (token) =>
    set((state) => ({
      currentStreamText: state.currentStreamText + token
    })),

  updateJudge: (index, updates) =>
    set((state) => ({
      judges: state.judges.map((j, i) => (i === index ? { ...j, ...updates } : j))
    })),

  setJudgeResult: (index, analysis) =>
    set((state) => ({
      judges: state.judges.map((j, i) =>
        i === index ? { ...j, analysis, isStreaming: false } : j
      )
    })),

  appendJudgeToken: (index, token) =>
    set((state) => ({
      judges: state.judges.map((j, i) =>
        i === index ? { ...j, analysis: j.analysis + token } : j
      )
    })),

  reset: () =>
    set({
      topic: '',
      totalRounds: DEFAULT_DEBATE_ROUNDS,
      forModel: { modelId: '', systemPrompt: DEFAULT_FOR_PROMPT },
      againstModel: { modelId: '', systemPrompt: DEFAULT_AGAINST_PROMPT },
      attachments: [],
      status: 'idle',
      currentRound: 0,
      currentSpeaker: null,
      messages: [],
      currentStreamText: '',
      judges: defaultJudges.map((j) => ({ ...j }))
    }),

  resetDebate: () =>
    set({
      status: 'idle',
      currentRound: 0,
      currentSpeaker: null,
      messages: [],
      currentStreamText: '',
      judges: get().judges.map((j) => ({
        ...j,
        analysis: '',
        isStreaming: false,
        error: null
      }))
    })
}))
