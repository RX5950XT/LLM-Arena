import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useArenaStore } from '@/stores/arena-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useHistoryStore } from '@/stores/history-store'
import { MAX_ARENA_SLOTS, MIN_ARENA_SLOTS } from '@/constants/config'
import { getArenaRunSnapshot, startArenaRun, stopArenaRun } from '@/services/arena-runner'
import { loadArenaLineup, saveArenaLineup } from '@/services/lineup-memory'
import { parseArenaLeaderboard } from '@/services/score-parser'
import type { ArenaLineup } from '@/services/lineup-memory'
import type { Attachment } from '@/types/models'
import type { StoredAttachment } from '@/types/history'
import { ApiKeyBanner, ModelName, RangeField, RecoveryBanner, Segmented } from '@/components/shared/controls'
import { DropZone } from '@/components/shared/DropZone'
import { Icon } from '@/components/shared/icons'
import { ModelSlot } from '@/components/shared/ModelSlot'
import { responseGridClass, ResponseCard, useResponseLayout } from '@/components/shared/ResponseCard'
import { VerdictPanel } from './VerdictPanel'

const RECOVERY_KEY = 'arena-recovery-state'
const RECOVERY_TTL_MS = 15 * 60 * 1000
const REPEAT_OPTIONS = ['1', '2', '3', '4', '5'] as const
const MAX_GHOST_CARDS = 6
const SAMPLE_PROMPTS = [
  '用三句話解釋什麼是量子糾纏，讓國中生也聽得懂',
  '寫一個 Python 函式，找出字串中最長的回文子字串',
  '幫我規劃三天兩夜的花蓮行程，預算一人一萬元'
]

interface RecoveryState extends ArenaLineup {
  historyId?: string
  userInput: string
  slotCount: number
  timestamp: number
}

function saveRecoveryState(state: RecoveryState): void {
  try {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('中斷恢復資料儲存失敗', error)
  }
}

function loadRecoveryState(): RecoveryState | null {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RecoveryState
    if (Date.now() - parsed.timestamp > RECOVERY_TTL_MS) {
      localStorage.removeItem(RECOVERY_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function getHistoryTitle(text: string): string {
  return text.trim().slice(0, 40) || '未命名對話'
}

function toStoredAttachments(attachments: Attachment[]): StoredAttachment[] {
  return attachments.map((attachment) => ({
    ...attachment,
    content: attachment.type === 'image' ? '' : attachment.content,
    isImagePlaceholder: attachment.type === 'image'
  }))
}

function slotLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

function applyLineup(lineup: ArenaLineup): void {
  const store = useArenaStore.getState()
  store.setSlotCount(Math.min(MAX_ARENA_SLOTS, Math.max(MIN_ARENA_SLOTS, lineup.slots.length)))
  store.setRepeatCount(lineup.repeatCount ?? 1)
  lineup.slots.slice(0, MAX_ARENA_SLOTS).forEach((slot, index) => store.updateSlot(index, slot))
  store.setJudgeModelId(lineup.judgeModelId ?? '')
  if (lineup.judgeSystemPrompt) store.setJudgeSystemPrompt(lineup.judgeSystemPrompt)
}

function useLineupRestore(onRecovered: () => void): void {
  const appliedRef = useRef(false)
  useEffect(() => {
    if (appliedRef.current) return
    appliedRef.current = true
    const state = useArenaStore.getState()
    if (state.slots.some((slot) => slot.modelId.trim() || slot.attempts.some((attempt) => attempt.responseText || attempt.isStreaming))) return
    const saved = loadRecoveryState()
    if (saved) {
      applyLineup(saved)
      state.setUserInput(saved.userInput)
      onRecovered()
      return
    }
    const lineup = loadArenaLineup()
    if (lineup) applyLineup(lineup)
  }, [onRecovered])
}

function LineupSummary({ modelIds, judgeModelId, onEdit }: { modelIds: string[]; judgeModelId: string; onEdit: () => void }): JSX.Element {
  return (
    <div className="panel flex items-center gap-2 py-1.5 pl-3 pr-1.5">
      <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto py-0.5">
        {modelIds.map((id, index) => id.trim() && (
          <span key={index} className="flex shrink-0 items-center gap-1.5">
            <span className="token !h-5 !w-5 !text-[11px]">{slotLetter(index)}</span>
            <ModelName id={id} className="max-w-52 text-xs" />
          </span>
        ))}
        {judgeModelId.trim() && (
          <span className="flex shrink-0 items-center gap-1.5 border-l border-line pl-3">
            <Icon name="scale" className="h-3.5 w-3.5 text-faint" />
            <ModelName id={judgeModelId} className="max-w-52 text-xs" />
          </span>
        )}
      </div>
      <button type="button" onClick={onEdit} className="btn btn-ghost !h-8">
        編輯陣容
        <Icon name="chevronDown" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function LineupToolbar({ onUnify, canUnify, onCollapse }: { onUnify: () => void; canUnify: boolean; onCollapse?: () => void }): JSX.Element {
  const slotCount = useArenaStore((state) => state.slotCount)
  const repeatCount = useArenaStore((state) => state.repeatCount)
  const isSending = useArenaStore((state) => state.isSending)
  const setSlotCount = useArenaStore((state) => state.setSlotCount)
  const setRepeatCount = useArenaStore((state) => state.setRepeatCount)

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-3 py-2.5">
      <RangeField
        id="arena-slot-count"
        label="模型數量"
        value={slotCount}
        min={MIN_ARENA_SLOTS}
        max={MAX_ARENA_SLOTS}
        unit="個"
        disabled={isSending}
        onChange={setSlotCount}
        className="w-full sm:w-72"
      />
      <div className="flex items-center gap-2.5">
        <span className="field-label">重複回答</span>
        <Segmented
          label="重複回答次數"
          value={String(repeatCount) as typeof REPEAT_OPTIONS[number]}
          disabled={isSending}
          options={REPEAT_OPTIONS.map((value) => ({ value, label: <span className="num">{value}</span>, title: `每個模型回答 ${value} 次` }))}
          onChange={(value) => setRepeatCount(Number(value))}
        />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onUnify}
          disabled={!canUnify || isSending}
          title={canUnify ? '把模型 A 的系統提示詞套用到全部模型' : '請先在模型 A 選擇或輸入系統提示詞'}
          className="btn btn-outline !h-8"
        >
          統一提示詞
        </button>
        {onCollapse && (
          <button type="button" onClick={onCollapse} aria-label="收合陣容" title="收合陣容" className="icon-btn">
            <Icon name="chevronDown" className="h-3.5 w-3.5 rotate-180" />
          </button>
        )}
      </div>
    </div>
  )
}

function LineupPanel({ onCollapse }: { onCollapse?: () => void }): JSX.Element {
  const slots = useArenaStore((state) => state.slots)
  const isSending = useArenaStore((state) => state.isSending)
  const judgeModelId = useArenaStore((state) => state.judgeModelId)
  const judgeSystemPrompt = useArenaStore((state) => state.judgeSystemPrompt)
  const { updateSlot, removeSlot, setAllSystemPrompts, setJudgeModelId, setJudgeSystemPrompt } = useArenaStore.getState()
  const firstPrompt = slots[0]?.systemPrompt ?? ''

  return (
    <section aria-label="模型陣容" className="panel card-enter">
      <LineupToolbar canUnify={firstPrompt.trim().length > 0} onUnify={() => setAllSystemPrompts(firstPrompt)} onCollapse={onCollapse} />
      <div className="grid gap-x-5 gap-y-2 p-3 lg:grid-cols-2">
        {slots.map((slot, index) => (
          <ModelSlot
            key={slot.id}
            label={`模型 ${slotLetter(index)}`}
            token={<span className="token">{slotLetter(index)}</span>}
            modelId={slot.modelId}
            systemPrompt={slot.systemPrompt}
            reasoning={slot.reasoning}
            disabled={isSending}
            showPromptLibrary
            onModelIdChange={(value) => updateSlot(index, { modelId: value })}
            onSystemPromptChange={(value) => updateSlot(index, { systemPrompt: value })}
            onReasoningChange={(value) => updateSlot(index, { reasoning: value })}
            onRemove={slots.length > 1 ? () => removeSlot(index) : undefined}
          />
        ))}
      </div>
      <div className="border-t border-line p-3">
        <ModelSlot
          label="裁判"
          placeholder="裁判模型（可不選；選了會比較所有回答並評分）"
          token={<span className="token" title="裁判會比較所有回答並評分，可不設定"><Icon name="scale" className="h-3.5 w-3.5" /></span>}
          modelId={judgeModelId}
          systemPrompt={judgeSystemPrompt}
          disabled={isSending}
          onModelIdChange={setJudgeModelId}
          onSystemPromptChange={setJudgeSystemPrompt}
        />
      </div>
    </section>
  )
}

function GhostResults({ modelIds, onPickSample }: { modelIds: string[]; onPickSample: (prompt: string) => void }): JSX.Element {
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[13px] text-muted">同一個問題同時問所有模型。試試看：</span>
        {SAMPLE_PROMPTS.map((prompt) => (
          <button key={prompt} type="button" onClick={() => onPickSample(prompt)} className="max-w-full cursor-pointer truncate rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors duration-150 hover:border-line-strong hover:text-ink">
            {prompt}
          </button>
        ))}
      </div>
      {modelIds.length <= MAX_GHOST_CARDS && (
        <div className={responseGridClass('columns')}>
          {modelIds.map((id, index) => (
            <div key={index} className="rounded-xl border border-dashed border-line-strong p-3">
              <div className="flex items-center gap-2">
                <span className="token">{slotLetter(index)}</span>
                {id.trim()
                  ? <ModelName id={id} className="text-[13px]" />
                  : <span className="text-[13px] text-faint">還沒選模型</span>}
              </div>
              <div className="mt-4 space-y-2.5" aria-hidden="true">
                <div className="h-2 w-11/12 rounded bg-line/70" />
                <div className="h-2 w-full rounded bg-line/70" />
                <div className="h-2 w-2/3 rounded bg-line/70" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ArenaPage(): JSX.Element {
  const store = useArenaStore()
  const { apiUrl, apiKey } = useSettingsStore()
  const activeArenaId = useHistoryStore((state) => state.activeArenaId)
  const [collapsedSlots, setCollapsedSlots] = useState<Set<number>>(new Set())
  const [recoveryBanner, setRecoveryBanner] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [layout, setLayout] = useResponseLayout()
  const [isLineupOpen, setIsLineupOpen] = useState(false)

  useLineupRestore(useCallback(() => setRecoveryBanner(true), []))

  useEffect(() => {
    const snapshot = getArenaRunSnapshot(activeArenaId)
    if (snapshot) useArenaStore.setState(snapshot)
    setCollapsedSlots(new Set())
    setIsLineupOpen(false)
    setNotice(null)
  }, [activeArenaId])

  const toggleCollapse = useCallback((index: number) => {
    setCollapsedSlots((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const handleSend = useCallback(() => {
    if (!store.userInput.trim() || store.isSending) return
    if (!apiKey) {
      setNotice('還沒有 API Key，請先在上方貼上金鑰。')
      return
    }
    if (!store.slots.some((slot) => slot.modelId.trim())) {
      setNotice('請至少選 1 個模型。')
      setIsLineupOpen(true)
      return
    }

    setNotice(null)
    setRecoveryBanner(false)
    setCollapsedSlots(new Set())
    setIsLineupOpen(false)
    store.resetResponses()
    store.setIsSending(true)

    const initialState = useArenaStore.getState()
    const lineup: ArenaLineup = {
      repeatCount: initialState.repeatCount,
      slots: initialState.slots.map((slot) => ({ modelId: slot.modelId, systemPrompt: slot.systemPrompt, reasoning: slot.reasoning ?? false })),
      judgeModelId: initialState.judgeModelId,
      judgeSystemPrompt: initialState.judgeSystemPrompt
    }
    saveArenaLineup(lineup)
    const historyId = useHistoryStore.getState().saveArena({
      title: getHistoryTitle(initialState.userInput),
      slotCount: initialState.slotCount,
      repeatCount: initialState.repeatCount,
      slots: initialState.slots.map((slot) => ({
        id: slot.id,
        modelId: slot.modelId,
        systemPrompt: slot.systemPrompt,
        reasoning: slot.reasoning ?? false,
        responseText: '',
        reasoningText: '',
        error: null,
        attempts: slot.attempts.map(() => ({
          responseText: '',
          reasoningText: '',
          isStreaming: Boolean(slot.modelId.trim()),
          error: null
        }))
      })),
      userInput: initialState.userInput,
      attachments: toStoredAttachments(initialState.attachments),
      judgeModelId: initialState.judgeModelId,
      judgeSystemPrompt: initialState.judgeSystemPrompt,
      judgeResult: null,
      judgeReasoningText: '',
      isSending: true,
      isJudging: false
    })
    saveRecoveryState({
      ...lineup,
      historyId,
      userInput: initialState.userInput,
      slotCount: initialState.slotCount,
      timestamp: Date.now()
    })
    startArenaRun(historyId, initialState, apiUrl, apiKey)
  }, [apiKey, apiUrl, store])

  const handleStop = useCallback(() => {
    stopArenaRun(activeArenaId)
  }, [activeArenaId])

  const hasResponses = store.slots.some((slot) =>
    slot.attempts.some((attempt) => attempt.responseText || attempt.reasoningText || attempt.isStreaming || attempt.error)
  )
  const hasVerdict = Boolean(store.judgeResult || store.judgeReasoningText || store.isJudging)
  const modelIds = store.slots.map((slot) => slot.modelId)
  const scores = useMemo(
    () => store.isJudging ? [] : parseArenaLeaderboard(store.judgeResult, modelIds),
    // modelIds 每次重建，比對內容即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.isJudging, store.judgeResult, modelIds.join('\n')]
  )
  const activeSlots = store.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.modelId.trim() || slot.attempts.some((attempt) => attempt.responseText || attempt.error))
  const doneCount = activeSlots.filter(({ slot }) => !slot.attempts.some((attempt) => attempt.isStreaming)).length
  const allCollapsed = activeSlots.length > 0 && activeSlots.every(({ index }) => collapsedSlots.has(index))
  const showFullLineup = !hasResponses || isLineupOpen

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1760px] flex-col gap-3 px-4 pt-4 md:px-6 md:pt-5">
      <h2 className="text-xl font-semibold">模型競技場</h2>
      <ApiKeyBanner />
      {recoveryBanner && <RecoveryBanner message="已恢復上次未完成的設定，按發送就能重新生成。" onDismiss={() => setRecoveryBanner(false)} />}

      {showFullLineup
        ? <LineupPanel onCollapse={hasResponses ? () => setIsLineupOpen(false) : undefined} />
        : <LineupSummary modelIds={modelIds} judgeModelId={store.judgeModelId} onEdit={() => setIsLineupOpen(true)} />}

      {hasResponses ? (
        <section aria-label="模型回應" className="flex flex-1 flex-col gap-3 pt-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">回應</h3>
            <span className="num text-xs text-muted">{doneCount} / {activeSlots.length} 完成</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                className="btn btn-ghost !h-8"
                onClick={() => setCollapsedSlots(allCollapsed ? new Set() : new Set(activeSlots.map(({ index }) => index)))}
              >
                {allCollapsed ? '全部展開' : '全部收合'}
              </button>
              <Segmented
                label="回應版面"
                value={layout}
                options={[
                  { value: 'columns', label: <Icon name="columns" className="h-3.5 w-3.5" />, title: '並排比較' },
                  { value: 'stack', label: <Icon name="rows" className="h-3.5 w-3.5" />, title: '單欄閱讀全文' }
                ]}
                onChange={setLayout}
              />
            </div>
          </div>
          <div className={responseGridClass(layout)}>
            {activeSlots.map(({ slot, index }) => {
              const score = scores.find((entry) => entry.slotIndex === index)
              return (
                <ResponseCard
                  key={slot.id}
                  token={slotLetter(index)}
                  modelId={slot.modelId || '未設定'}
                  attempts={slot.attempts}
                  rank={score?.rank}
                  score={score?.score}
                  layout={layout}
                  isCollapsed={collapsedSlots.has(index)}
                  onToggleCollapse={() => toggleCollapse(index)}
                />
              )
            })}
          </div>
          {hasVerdict && (
            <VerdictPanel
              judgeModelId={store.judgeModelId}
              result={store.judgeResult}
              reasoningText={store.judgeReasoningText}
              isJudging={store.isJudging}
              scores={scores}
              modelIds={modelIds}
            />
          )}
        </section>
      ) : (
        <GhostResults modelIds={modelIds} onPickSample={store.setUserInput} />
      )}

      <div className="sticky bottom-0 z-20 -mx-1 mt-auto bg-gradient-to-t from-canvas from-70% to-transparent px-1 pb-3 pt-4 md:pb-4">
        <DropZone
          attachments={store.attachments}
          onAdd={store.addAttachment}
          onRemove={store.removeAttachment}
          userInput={store.userInput}
          onInputChange={(value) => {
            setNotice(null)
            store.setUserInput(value)
          }}
          onSend={handleSend}
          onStop={handleStop}
          isSending={store.isSending}
          notice={notice}
        />
      </div>
    </div>
  )
}
