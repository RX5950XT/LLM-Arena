import { create } from 'zustand'
import type { DebateMessage, DebateStatus, DebateSide, JudgeResult } from '@/types/debate'
import type { Attachment, ModelConfig } from '@/types/models'
import type { DebateHistoryEntry } from '@/types/history'
import {
  DEFAULT_FOR_PROMPT,
  DEFAULT_AGAINST_PROMPT,
  DEBATE_JUDGE_DEFAULTS
} from '@/constants/default-prompts'
import { DEFAULT_DEBATE_ROUNDS } from '@/constants/config'

interface DebateActions {
  setTopic: (topic: string) => void
  setTotalRounds: (rounds: number) => void
  setStartingSide: (side: DebateSide) => void
  setForModel: (config: Partial<ModelConfig>) => void
  setAgainstModel: (config: Partial<ModelConfig>) => void
  addAttachment: (attachment: Attachment) => void
  removeAttachment: (id: string) => void
  setStatus: (status: DebateStatus) => void
  setCurrentRound: (round: number) => void
  setCurrentSpeaker: (speaker: DebateSide | null) => void
  appendMessage: (message: DebateMessage) => void
  setCurrentStreamText: (text: string) => void
  setCurrentStreamReasoningText: (text: string) => void
  appendStreamToken: (token: string) => void
  appendCurrentStreamReasoningToken: (token: string) => void
  updateJudge: (index: number, updates: Partial<JudgeResult>) => void
  setJudgeResult: (index: number, analysis: string) => void
  appendJudgeToken: (index: number, token: string) => void
  appendJudgeReasoningToken: (index: number, token: string) => void
  reset: () => void
  resetDebate: () => void
  restoreFromHistory: (entry: DebateHistoryEntry) => void
}

interface DebateStore {
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

const defaultJudges: JudgeResult[] = DEBATE_JUDGE_DEFAULTS.map((j) => ({
  name: j.name,
  modelId: '',
  systemPrompt: j.systemPrompt,
  analysis: '',
  reasoningText: '',
  isStreaming: false,
  error: null
}))

export const useDebateStore = create<DebateStore & DebateActions>((set, get) => ({
  topic: '',
  totalRounds: DEFAULT_DEBATE_ROUNDS,
  startingSide: 'for',
  forModel: { modelId: '', systemPrompt: DEFAULT_FOR_PROMPT },
  againstModel: { modelId: '', systemPrompt: DEFAULT_AGAINST_PROMPT },
  attachments: [],
  status: 'idle',
  currentRound: 0,
  currentSpeaker: null,
  messages: [],
  currentStreamText: '',
  currentStreamReasoningText: '',
  judges: defaultJudges.map((j) => ({ ...j })),

  setTopic: (topic) => set({ topic }),
  setTotalRounds: (totalRounds) => set({ totalRounds }),
  setStartingSide: (startingSide) => set({ startingSide }),

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
      currentStreamText: '',
      currentStreamReasoningText: ''
    })),

  setCurrentStreamText: (currentStreamText) => set({ currentStreamText }),
  setCurrentStreamReasoningText: (currentStreamReasoningText) => set({ currentStreamReasoningText }),

  appendStreamToken: (token) =>
    set((state) => ({
      currentStreamText: state.currentStreamText + token
    })),

  appendCurrentStreamReasoningToken: (token) =>
    set((state) => ({
      currentStreamReasoningText: state.currentStreamReasoningText + token
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

  appendJudgeReasoningToken: (index, token) =>
    set((state) => ({
      judges: state.judges.map((j, i) =>
        i === index ? { ...j, reasoningText: j.reasoningText + token } : j
      )
    })),

  reset: () =>
    set({
      topic: '',
      totalRounds: DEFAULT_DEBATE_ROUNDS,
      startingSide: 'for',
      forModel: { modelId: '', systemPrompt: DEFAULT_FOR_PROMPT },
      againstModel: { modelId: '', systemPrompt: DEFAULT_AGAINST_PROMPT },
      attachments: [],
      status: 'idle',
      currentRound: 0,
      currentSpeaker: null,
      messages: [],
      currentStreamText: '',
      currentStreamReasoningText: '',
      judges: defaultJudges.map((j) => ({ ...j }))
    }),

  resetDebate: () =>
    set({
      status: 'idle',
      currentRound: 0,
      currentSpeaker: null,
      messages: [],
      currentStreamText: '',
      currentStreamReasoningText: '',
      judges: get().judges.map((j) => ({
        ...j,
        analysis: '',
        reasoningText: '',
        isStreaming: false,
        error: null
      }))
    }),

  restoreFromHistory: (entry) => {
    const attachments: Attachment[] = entry.attachments
      .filter((a) => !a.isImagePlaceholder)
      .map(({ isImagePlaceholder: _, ...rest }) => rest)
    const currentJudges = get().judges
    const restoredJudges: JudgeResult[] = currentJudges.map((j, i) => {
      const saved = entry.judges[i]
      if (!saved) return j
      return { ...j, modelId: saved.modelId, systemPrompt: saved.systemPrompt, analysis: saved.analysis, reasoningText: saved.reasoningText ?? '', isStreaming: false, error: saved.error ?? null }
    })
    set({
      topic: entry.topic,
      totalRounds: entry.totalRounds,
      startingSide: entry.startingSide === 'against' ? 'against' : 'for',
      forModel: entry.forModel as ModelConfig,
      againstModel: entry.againstModel as ModelConfig,
      attachments,
      messages: entry.messages as DebateMessage[],
      judges: restoredJudges,
      status: 'idle',
      currentRound: entry.currentRound ?? 0,
      currentSpeaker: entry.currentSpeaker ?? null,
      currentStreamText: entry.currentStreamText ?? '',
      currentStreamReasoningText: entry.currentStreamReasoningText ?? ''
    })
  }
}))
