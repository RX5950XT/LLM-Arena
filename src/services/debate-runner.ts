import { useDebateStore } from '@/stores/debate-store'
import { useHistoryStore } from '@/stores/history-store'
import { useSettingsStore } from '@/stores/settings-store'
import { DebateOrchestrator } from './debate-orchestrator'
import { OpenRouterClient } from './openrouter-client'
import { generateTitle } from './title-generator'
import type { DebateState } from '@/types/debate'
import type { DebateHistoryEntry, StoredAttachment } from '@/types/history'
import type { Attachment } from '@/types/models'

export interface DebateRunInput {
  apiUrl: string
  apiKey: string
  state: DebateState
  onCompleted?: (id: string) => void
}

interface DebateRun {
  id: string
  state: DebateState
  orchestrator: DebateOrchestrator
  stopped: boolean
}

const runs = new Map<string, DebateRun>()

function cloneState(state: DebateState): DebateState {
  return {
    topic: state.topic,
    totalRounds: state.totalRounds,
    startingSide: state.startingSide,
    forModel: { ...state.forModel },
    againstModel: { ...state.againstModel },
    attachments: state.attachments.map((attachment) => ({ ...attachment })),
    status: state.status,
    currentRound: state.currentRound,
    currentSpeaker: state.currentSpeaker,
    messages: state.messages.map((message) => ({ ...message })),
    currentStreamText: state.currentStreamText,
    currentStreamReasoningText: state.currentStreamReasoningText,
    judges: state.judges.map((judge) => ({ ...judge }))
  }
}

function toStoredAttachments(attachments: Attachment[]): StoredAttachment[] {
  return attachments.map((attachment) => ({
    ...attachment,
    content: attachment.type === 'image' ? '' : attachment.content,
    isImagePlaceholder: attachment.type === 'image'
  }))
}

function isLive(run: DebateRun): boolean {
  return runs.get(run.id) === run && !run.stopped
}

function historyData(state: DebateState): Partial<DebateHistoryEntry> {
  return {
    topic: state.topic,
    totalRounds: state.totalRounds,
    startingSide: state.startingSide,
    forModel: state.forModel,
    againstModel: state.againstModel,
    attachments: toStoredAttachments(state.attachments),
    messages: state.messages,
    status: state.status,
    currentRound: state.currentRound,
    currentSpeaker: state.currentSpeaker,
    currentStreamText: state.currentStreamText,
    currentStreamReasoningText: state.currentStreamReasoningText,
    judges: state.judges.map((judge) => ({
      name: judge.name,
      modelId: judge.modelId,
      systemPrompt: judge.systemPrompt,
      analysis: judge.analysis,
      reasoningText: judge.reasoningText,
      isStreaming: judge.isStreaming,
      error: judge.error
    }))
  }
}

function publish(run: DebateRun): void {
  useHistoryStore.getState().updateDebate(run.id, historyData(run.state))
  if (useHistoryStore.getState().activeDebateId === run.id) useDebateStore.setState(run.state)
}

export function getDebateRunSnapshot(id: string | null): DebateState | null {
  const run = id ? runs.get(id) : undefined
  return run ? cloneState(run.state) : null
}

export function stopDebateRun(id: string | null): void {
  const run = id ? runs.get(id) : undefined
  if (!run) return
  run.stopped = true
  run.orchestrator.stop()
  run.state = run.orchestrator.getState()
  publish(run)
  runs.delete(run.id)
}

export function startDebateRun(id: string, input: DebateRunInput): void {
  stopDebateRun(id)
  const state = cloneState(input.state)
  const orchestrator = new DebateOrchestrator(
    new OpenRouterClient(input.apiUrl, input.apiKey),
    state,
    (nextState) => {
      const run = runs.get(id)
      if (!run || run.orchestrator !== orchestrator || run.stopped) return
      run.state = nextState
      publish(run)
    }
  )
  const run: DebateRun = { id, state, orchestrator, stopped: false }
  runs.set(id, run)
  void orchestrator.startDebate().then((completed) => {
    if (!completed || !isLive(run)) return
    input.onCompleted?.(run.id)
    const settings = useSettingsStore.getState()
    void generateTitle(
      settings.apiUrl,
      settings.apiKey,
      settings.titleModelId,
      run.state.topic,
      run.state.attachments
    ).then((title) => useHistoryStore.getState().updateDebate(run.id, { title }))
  }).catch((error) => {
    if (isLive(run)) console.error('辯論背景執行發生錯誤:', error)
  }).finally(() => {
    if (!isLive(run)) return
    run.state = orchestrator.getState()
    publish(run)
    runs.delete(run.id)
  })
}
