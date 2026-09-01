import { create } from 'zustand'
import type { ArenaAttempt, ArenaSlot } from '@/types/arena'
import type { Attachment } from '@/types/models'
import type { ArenaHistoryEntry } from '@/types/history'
import { ARENA_JUDGE_DEFAULT_PROMPT } from '@/constants/default-prompts'

function createSlot(index: number): ArenaSlot {
  return {
    id: `slot-${index}`,
    modelId: '',
    systemPrompt: '',
    reasoning: false,
    attempts: [createAttempt()]
  }
}

function createAttempt(): ArenaAttempt {
  return { responseText: '', reasoningText: '', isStreaming: false, error: null }
}

function createAttempts(count: number): ArenaAttempt[] {
  return Array.from({ length: count }, createAttempt)
}

function clampRepeatCount(count: number): number {
  return Number.isFinite(count) ? Math.min(5, Math.max(1, Math.round(count))) : 1
}

interface ArenaActions {
  setSlotCount: (count: number) => void
  setRepeatCount: (count: number) => void
  updateSlot: (index: number, updates: Partial<ArenaSlot>) => void
  setAllSystemPrompts: (prompt: string) => void
  updateAttempt: (slotIndex: number, attemptIndex: number, updates: Partial<ArenaAttempt>) => void
  appendAttemptToken: (slotIndex: number, attemptIndex: number, token: string) => void
  appendAttemptReasoningToken: (slotIndex: number, attemptIndex: number, token: string) => void
  setUserInput: (input: string) => void
  addAttachment: (attachment: Attachment) => void
  removeAttachment: (id: string) => void
  setJudgeModelId: (modelId: string) => void
  setJudgeSystemPrompt: (prompt: string) => void
  setJudgeResult: (result: string | null) => void
  appendJudgeReasoningToken: (token: string) => void
  setIsJudging: (isJudging: boolean) => void
  setIsSending: (isSending: boolean) => void
  resetResponses: () => void
  resetAll: () => void
  restoreFromHistory: (entry: ArenaHistoryEntry) => void
}

interface ArenaStore {
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

export const useArenaStore = create<ArenaStore & ArenaActions>((set, get) => ({
  slots: [createSlot(0), createSlot(1)],
  slotCount: 2,
  repeatCount: 1,
  userInput: '',
  attachments: [],
  judgeModelId: '',
  judgeSystemPrompt: ARENA_JUDGE_DEFAULT_PROMPT,
  judgeResult: null,
  judgeReasoningText: '',
  isJudging: false,
  isSending: false,

  setSlotCount: (count) => {
    const currentSlots = get().slots
    const newSlots = Array.from({ length: count }, (_, i) =>
      i < currentSlots.length ? currentSlots[i] : createSlot(i)
    )
    set({ slotCount: count, slots: newSlots })
  },

  setRepeatCount: (count) => set({ repeatCount: clampRepeatCount(count) }),

  updateSlot: (index, updates) => {
    set((state) => ({
      slots: state.slots.map((slot, i) =>
        i === index ? { ...slot, ...updates } : slot
      )
    }))
  },

  setAllSystemPrompts: (prompt) => {
    set((state) => ({
      slots: state.slots.map((slot) => ({ ...slot, systemPrompt: prompt }))
    }))
  },

  updateAttempt: (slotIndex, attemptIndex, updates) => {
    set((state) => ({
      slots: state.slots.map((slot, i) =>
        i === slotIndex
          ? {
              ...slot,
              attempts: slot.attempts.map((attempt, j) =>
                j === attemptIndex ? { ...attempt, ...updates } : attempt
              )
            }
          : slot
      )
    }))
  },

  appendAttemptToken: (slotIndex, attemptIndex, token) => {
    set((state) => ({
      slots: state.slots.map((slot, i) =>
        i === slotIndex
          ? {
              ...slot,
              attempts: slot.attempts.map((attempt, j) =>
                j === attemptIndex ? { ...attempt, responseText: attempt.responseText + token } : attempt
              )
            }
          : slot
      )
    }))
  },

  appendAttemptReasoningToken: (slotIndex, attemptIndex, token) => {
    set((state) => ({
      slots: state.slots.map((slot, i) =>
        i === slotIndex
          ? {
              ...slot,
              attempts: slot.attempts.map((attempt, j) =>
                j === attemptIndex ? { ...attempt, reasoningText: attempt.reasoningText + token } : attempt
              )
            }
          : slot
      )
    }))
  },

  setUserInput: (input) => set({ userInput: input }),

  addAttachment: (attachment) =>
    set((state) => ({ attachments: [...state.attachments, attachment] })),

  removeAttachment: (id) =>
    set((state) => ({
      attachments: state.attachments.filter((a) => a.id !== id)
    })),

  setJudgeModelId: (modelId) => set({ judgeModelId: modelId }),
  setJudgeSystemPrompt: (prompt) => set({ judgeSystemPrompt: prompt }),
  setJudgeResult: (result) => set({ judgeResult: result }),
  appendJudgeReasoningToken: (token) =>
    set((state) => ({ judgeReasoningText: state.judgeReasoningText + token })),
  setIsJudging: (isJudging) => set({ isJudging }),
  setIsSending: (isSending) => set({ isSending }),

  resetResponses: () => {
    set((state) => ({
      slots: state.slots.map((slot) => ({
        ...slot,
        attempts: createAttempts(state.repeatCount)
      })),
      judgeResult: null,
      judgeReasoningText: '',
      isJudging: false,
      isSending: false
    }))
  },

  resetAll: () => {
    set((state) => ({
      slots: Array.from({ length: state.slotCount }, (_, i) => createSlot(i)),
      repeatCount: 1,
      userInput: '',
      attachments: [],
      judgeModelId: '',
      judgeSystemPrompt: ARENA_JUDGE_DEFAULT_PROMPT,
      judgeResult: null,
      judgeReasoningText: '',
      isJudging: false,
      isSending: false
    }))
  },

  restoreFromHistory: (entry) => {
    const restoredSlots: ArenaSlot[] = entry.slots.map((s, i) => ({
      id: `slot-${i}`,
      modelId: s.modelId,
      systemPrompt: s.systemPrompt,
      reasoning: s.reasoning,
      attempts: (s.attempts?.length ? s.attempts : [{
        responseText: s.responseText,
        reasoningText: s.reasoningText,
        error: s.error
      }]).map((attempt) => ({
        responseText: attempt.responseText,
        reasoningText: attempt.reasoningText ?? '',
        isStreaming: false,
        error: attempt.error
      }))
    }))
    const attachments: Attachment[] = entry.attachments
      .filter((a) => !a.isImagePlaceholder)
      .map(({ isImagePlaceholder: _, ...rest }) => rest)
    set({
      slotCount: entry.slotCount,
      repeatCount: clampRepeatCount(entry.repeatCount ?? restoredSlots[0]?.attempts.length ?? 1),
      slots: restoredSlots,
      userInput: entry.userInput,
      attachments,
      judgeModelId: entry.judgeModelId,
      judgeSystemPrompt: entry.judgeSystemPrompt,
      judgeResult: entry.judgeResult,
      judgeReasoningText: entry.judgeReasoningText ?? '',
      isJudging: false,
      isSending: false
    })
  }
}))
