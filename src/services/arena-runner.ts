import { useArenaStore } from '@/stores/arena-store'
import { useHistoryStore } from '@/stores/history-store'
import { useSettingsStore } from '@/stores/settings-store'
import { OpenRouterClient } from './openrouter-client'
import { StreamingManager } from './streaming-manager'
import { buildContentParts } from './file-handler'
import { generateTitle } from './title-generator'
import type { ArenaState } from '@/types/arena'
import type { ArenaHistoryEntry, StoredAttachment } from '@/types/history'
import type { Attachment, ChatMessage } from '@/types/models'
import type { StreamTask } from './streaming-manager'

interface ArenaRun {
  id: string
  state: ArenaState
  client: OpenRouterClient
  manager: StreamingManager
  controller: AbortController
  stopped: boolean
}

const runs = new Map<string, ArenaRun>()
const RECOVERY_KEY = 'arena-recovery-state'

function cloneState(state: ArenaState): ArenaState {
  return {
    slots: state.slots.map((slot) => ({
      ...slot,
      attempts: slot.attempts.map((attempt) => ({ ...attempt }))
    })),
    slotCount: state.slotCount,
    repeatCount: state.repeatCount,
    userInput: state.userInput,
    attachments: state.attachments.map((attachment) => ({ ...attachment })),
    judgeModelId: state.judgeModelId,
    judgeSystemPrompt: state.judgeSystemPrompt,
    judgeResult: state.judgeResult,
    judgeReasoningText: state.judgeReasoningText,
    isJudging: state.isJudging,
    isSending: state.isSending
  }
}

function toStoredAttachments(attachments: Attachment[]): StoredAttachment[] {
  return attachments.map((attachment) => ({
    ...attachment,
    content: attachment.type === 'image' ? '' : attachment.content,
    isImagePlaceholder: attachment.type === 'image'
  }))
}

function isLive(run: ArenaRun): boolean {
  return runs.get(run.id) === run && !run.stopped
}

function syncStore(state: ArenaState): void {
  useArenaStore.setState({
    slots: state.slots,
    slotCount: state.slotCount,
    repeatCount: state.repeatCount,
    userInput: state.userInput,
    attachments: state.attachments,
    judgeModelId: state.judgeModelId,
    judgeSystemPrompt: state.judgeSystemPrompt,
    judgeResult: state.judgeResult,
    judgeReasoningText: state.judgeReasoningText,
    isJudging: state.isJudging,
    isSending: state.isSending
  })
}

function historyData(state: ArenaState): Partial<ArenaHistoryEntry> {
  return {
    slotCount: state.slotCount,
    repeatCount: state.repeatCount,
    slots: state.slots.map((slot) => ({
      id: slot.id,
      modelId: slot.modelId,
      systemPrompt: slot.systemPrompt,
      reasoning: slot.reasoning ?? false,
      responseText: slot.attempts.map((attempt) => attempt.responseText).join('\n\n'),
      reasoningText: slot.attempts.map((attempt) => attempt.reasoningText).filter(Boolean).join('\n\n'),
      error: slot.attempts.find((attempt) => attempt.error)?.error ?? null,
      attempts: slot.attempts.map(({ responseText, reasoningText, isStreaming, error }) => ({
        responseText,
        reasoningText,
        isStreaming,
        error
      }))
    })),
    userInput: state.userInput,
    attachments: toStoredAttachments(state.attachments),
    judgeModelId: state.judgeModelId,
    judgeSystemPrompt: state.judgeSystemPrompt,
    judgeResult: state.judgeResult,
    judgeReasoningText: state.judgeReasoningText,
    isSending: state.isSending,
    isJudging: state.isJudging
  }
}

function publish(run: ArenaRun): void {
  useHistoryStore.getState().updateArena(run.id, historyData(run.state))
  if (useHistoryStore.getState().activeArenaId === run.id) syncStore(run.state)
}

function updateRun(run: ArenaRun, updater: (state: ArenaState) => ArenaState): void {
  if (!isLive(run)) return
  run.state = updater(run.state)
  publish(run)
}

function updateAttempt(
  state: ArenaState,
  slotIndex: number,
  attemptIndex: number,
  updates: Partial<ArenaState['slots'][number]['attempts'][number]>
): ArenaState {
  return {
    ...state,
    slots: state.slots.map((slot, index) => index !== slotIndex ? slot : {
      ...slot,
      attempts: slot.attempts.map((attempt, index) => index === attemptIndex ? { ...attempt, ...updates } : attempt)
    })
  }
}

function updateJudgeState(state: ArenaState, updates: Partial<ArenaState>): ArenaState {
  return { ...state, ...updates }
}

function stopState(state: ArenaState): ArenaState {
  return {
    ...state,
    slots: state.slots.map((slot) => ({
      ...slot,
      attempts: slot.attempts.map((attempt) => ({ ...attempt, isStreaming: false }))
    })),
    isJudging: false,
    isSending: false
  }
}

function clearRecoveryState(id: string): void {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY)
    const saved = raw ? JSON.parse(raw) as { historyId?: string } : null
    if (!saved?.historyId || saved.historyId === id) localStorage.removeItem(RECOVERY_KEY)
  } catch {
    // localStorage unavailable
  }
}

function buildJudgeSummary(state: ArenaState): string {
  return state.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.modelId.trim())
    .map(({ slot, index }) => [
      `## 模型 ${String.fromCharCode(65 + index)}（${slot.modelId}）`,
      `### 系統提示詞\n${slot.systemPrompt.trim() || '（未設定）'}`,
      `### 使用者問題\n${state.userInput}`,
      slot.attempts.map((attempt, attemptIndex) => [
        `### 第 ${attemptIndex + 1} 次回答`,
        attempt.responseText.trim() || '（模型沒有產生回答）',
        attempt.error ? `#### 執行狀態\n${attempt.error}` : ''
      ].filter(Boolean).join('\n')).join('\n\n')
    ].join('\n'))
    .join('\n\n---\n\n')
}

async function runJudge(run: ArenaRun, client: OpenRouterClient): Promise<void> {
  const state = run.state
  if (!state.judgeModelId.trim() || !isLive(run)) return

  const responseSummary = buildJudgeSummary(state)
  const judgeUserContent = buildContentParts(
    `以下是各模型的完整比較資料；每個模型都包含自己的系統提示詞、同一個使用者問題與 ${state.repeatCount} 次獨立回答。請對每次回答逐一評分，再計算同一模型所有回答的平均總分：各次總分相加後除以 ${state.repeatCount}，四捨五入到小數第 2 位。失敗或空回答也要視為該次結果評估，不要只取最高分。排名請依平均總分。\n\n${responseSummary}\n\n請進行評比分析。`,
    state.attachments
  )
  const messages: ChatMessage[] = [
    { role: 'system', content: state.judgeSystemPrompt },
    { role: 'user', content: judgeUserContent }
  ]
  let judgeText = ''

  updateRun(run, (current) => updateJudgeState(current, { isJudging: true, judgeResult: null, judgeReasoningText: '' }))
  try {
    await client.streamChat(run.state.judgeModelId, messages, {
      onToken: (token) => {
        judgeText += token
        updateRun(run, (current) => updateJudgeState(current, { judgeResult: judgeText }))
      },
      onReasoningToken: (token) => {
        updateRun(run, (current) => updateJudgeState(current, {
          judgeReasoningText: current.judgeReasoningText + token
        }))
      },
      onComplete: (text) => {
        updateRun(run, (current) => updateJudgeState(current, {
          judgeResult: text,
          isJudging: false
        }))
      },
      onError: (error) => {
        updateRun(run, (current) => updateJudgeState(current, {
          judgeResult: `評審錯誤: ${error.message}`,
          isJudging: false
        }))
      }
    }, run.controller.signal)
  } catch (error) {
    if (!run.controller.signal.aborted) {
      const message = error instanceof Error ? error.message : String(error)
      updateRun(run, (current) => updateJudgeState(current, {
        judgeResult: `評審錯誤: ${message}`,
        isJudging: false
      }))
    }
  }
}

async function runArena(run: ArenaRun): Promise<void> {
  const validSlots = run.state.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.modelId.trim())
  const userContent = buildContentParts(run.state.userInput, run.state.attachments)
  const tasks: StreamTask[] = validSlots.flatMap(({ slot, index: slotIndex }) =>
    Array.from({ length: run.state.repeatCount }, (_, attemptIndex) => {
      const messages: ChatMessage[] = []
      if (slot.systemPrompt) messages.push({ role: 'system', content: slot.systemPrompt })
      messages.push({ role: 'user', content: userContent })
      return {
        id: `${slot.id}-attempt-${attemptIndex}`,
        modelId: slot.modelId,
        messages,
        options: { reasoning: slot.reasoning ?? false },
        callbacks: {
          onToken: (token: string) => updateRun(run, (state) => updateAttempt(state, slotIndex, attemptIndex, {
            responseText: state.slots[slotIndex].attempts[attemptIndex].responseText + token
          })),
          onReasoningToken: (token: string) => updateRun(run, (state) => updateAttempt(state, slotIndex, attemptIndex, {
            reasoningText: state.slots[slotIndex].attempts[attemptIndex].reasoningText + token
          })),
          onComplete: () => updateRun(run, (state) => updateAttempt(state, slotIndex, attemptIndex, { isStreaming: false })),
          onError: (error: Error) => updateRun(run, (state) => updateAttempt(state, slotIndex, attemptIndex, {
            isStreaming: false,
            error: error.message
          }))
        }
      }
    })
  )

  try {
    await run.manager.streamAll(tasks)
    if (!isLive(run)) return
    await runJudge(run, run.client)
    if (!isLive(run)) return

    run.state = { ...run.state, isJudging: false, isSending: false }
    publish(run)
    clearRecoveryState(run.id)
    const settings = useSettingsStore.getState()
    void generateTitle(
      settings.apiUrl,
      settings.apiKey,
      settings.titleModelId,
      run.state.userInput,
      run.state.attachments
    ).then((title) => useHistoryStore.getState().updateArena(run.id, { title }))
  } catch (error) {
    if (!run.controller.signal.aborted) console.error('競技場執行發生錯誤:', error)
  } finally {
    if (isLive(run)) {
      run.state = stopState(run.state)
      publish(run)
      runs.delete(run.id)
    }
  }
}

export function getArenaRunSnapshot(id: string | null): ArenaState | null {
  const run = id ? runs.get(id) : undefined
  return run ? cloneState(run.state) : null
}

export function stopArenaRun(id: string | null): void {
  const run = id ? runs.get(id) : undefined
  if (!run) return
  run.stopped = true
  run.controller.abort()
  run.manager.cancelAll()
  run.state = stopState(run.state)
  publish(run)
  runs.delete(run.id)
}

export function startArenaRun(id: string, state: ArenaState, apiUrl: string, apiKey: string): void {
  stopArenaRun(id)
  const initialState = cloneState(state)
  initialState.slots = initialState.slots.map((slot) => ({
    ...slot,
    attempts: slot.attempts.map((attempt) => ({
      ...attempt,
      isStreaming: Boolean(slot.modelId.trim()),
      error: null
    }))
  }))
  initialState.isJudging = false
  initialState.isSending = true
  const client = new OpenRouterClient(apiUrl, apiKey)
  const run: ArenaRun = {
    id,
    state: initialState,
    client,
    manager: new StreamingManager(client),
    controller: new AbortController(),
    stopped: false
  }
  runs.set(id, run)
  publish(run)
  void runArena(run)
}
