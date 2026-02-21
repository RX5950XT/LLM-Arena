import { create } from 'zustand'
import type { ArenaSlot } from '@/types/arena'
import type { Attachment } from '@/types/models'
import type { ArenaHistoryEntry } from '@/types/history'
import { ARENA_JUDGE_DEFAULT_PROMPT } from '@/constants/default-prompts'

function createSlot(index: number): ArenaSlot {
  return {
    id: `slot-${index}`,
    modelId: '',
    systemPrompt: '',
    reasoning: false,
    responseText: '',
    isStreaming: false,
    error: null
  }
}

interface ArenaActions {
  setSlotCount: (count: number) => void
  updateSlot: (index: number, updates: Partial<ArenaSlot>) => void
  appendToken: (index: number, token: string) => void
  setUserInput: (input: string) => void
  addAttachment: (attachment: Attachment) => void
  removeAttachment: (id: string) => void
  setJudgeModelId: (modelId: string) => void
  setJudgeSystemPrompt: (prompt: string) => void
  setJudgeResult: (result: string | null) => void
  setIsJudging: (isJudging: boolean) => void
  setIsSending: (isSending: boolean) => void
  resetResponses: () => void
  resetAll: () => void
  restoreFromHistory: (entry: ArenaHistoryEntry) => void
}

interface ArenaStore {
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

export const useArenaStore = create<ArenaStore & ArenaActions>((set, get) => ({
  slots: [createSlot(0), createSlot(1)],
  slotCount: 2,
  userInput: '',
  attachments: [],
  judgeModelId: '',
  judgeSystemPrompt: ARENA_JUDGE_DEFAULT_PROMPT,
  judgeResult: null,
  isJudging: false,
  isSending: false,

  setSlotCount: (count) => {
    const currentSlots = get().slots
    const newSlots = Array.from({ length: count }, (_, i) =>
      i < currentSlots.length ? currentSlots[i] : createSlot(i)
    )
    set({ slotCount: count, slots: newSlots })
  },

  updateSlot: (index, updates) => {
    set((state) => ({
      slots: state.slots.map((slot, i) =>
        i === index ? { ...slot, ...updates } : slot
      )
    }))
  },

  appendToken: (index, token) => {
    set((state) => ({
      slots: state.slots.map((slot, i) =>
        i === index ? { ...slot, responseText: slot.responseText + token } : slot
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
  setIsJudging: (isJudging) => set({ isJudging }),
  setIsSending: (isSending) => set({ isSending }),

  resetResponses: () => {
    set((state) => ({
      slots: state.slots.map((slot) => ({
        ...slot,
        responseText: '',
        isStreaming: false,
        error: null
      })),
      judgeResult: null,
      isJudging: false,
      isSending: false
    }))
  },

  resetAll: () => {
    set((state) => ({
      slots: Array.from({ length: state.slotCount }, (_, i) => createSlot(i)),
      userInput: '',
      attachments: [],
      judgeModelId: '',
      judgeSystemPrompt: ARENA_JUDGE_DEFAULT_PROMPT,
      judgeResult: null,
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
      responseText: s.responseText,
      isStreaming: false,
      error: s.error
    }))
    const attachments: Attachment[] = entry.attachments
      .filter((a) => !a.isImagePlaceholder)
      .map(({ isImagePlaceholder: _, ...rest }) => rest)
    set({
      slotCount: entry.slotCount,
      slots: restoredSlots,
      userInput: entry.userInput,
      attachments,
      judgeModelId: entry.judgeModelId,
      judgeSystemPrompt: entry.judgeSystemPrompt,
      judgeResult: entry.judgeResult,
      isJudging: false,
      isSending: false
    })
  }
}))
