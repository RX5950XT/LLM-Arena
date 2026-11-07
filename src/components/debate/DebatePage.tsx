import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebateStore } from '@/stores/debate-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useHistoryStore } from '@/stores/history-store'
import { getDebateRunSnapshot, startDebateRun, stopDebateRun } from '@/services/debate-runner'
import { loadDebateLineup, saveDebateLineup } from '@/services/lineup-memory'
import { MIN_DEBATE_ROUNDS, MAX_DEBATE_ROUNDS } from '@/constants/config'
import { ApiKeyBanner, ModelName, RangeField, RecoveryBanner, Segmented } from '@/components/shared/controls'
import { DropZone } from '@/components/shared/DropZone'
import { Icon } from '@/components/shared/icons'
import { ModelSlot } from '@/components/shared/ModelSlot'
import type { StoredAttachment } from '@/types/history'
import type { Attachment } from '@/types/models'
import type { DebateSide } from '@/types/debate'
import { DebateRounds, DebateStatusBar, SideToken } from './DebateMatch'
import { JudgePanel } from './JudgePanel'

const DEBATE_RECOVERY_KEY = 'debate-recovery-state'
const RECOVERY_TTL_MS = 15 * 60 * 1000
const SAMPLE_TOPICS = [
  'AI 生成的內容應該強制標示',
  '遠距工作比進辦公室更有生產力',
  '大學應該取消必修課'
]

interface DebateRecoveryState {
  historyId?: string
  topic: string
  totalRounds: number
  startingSide?: DebateSide
  forModelId: string
  forSystemPrompt: string
  againstModelId: string
  againstSystemPrompt: string
  timestamp: number
}

function saveDebateRecovery(state: DebateRecoveryState): void {
  try {
    localStorage.setItem(DEBATE_RECOVERY_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('中斷恢復資料儲存失敗', error)
  }
}

function clearDebateRecovery(historyId?: string): void {
  try {
    const raw = localStorage.getItem(DEBATE_RECOVERY_KEY)
    const saved = raw ? JSON.parse(raw) as { historyId?: string } : null
    if (!saved?.historyId || saved.historyId === historyId) localStorage.removeItem(DEBATE_RECOVERY_KEY)
  } catch (error) {
    console.warn('中斷恢復資料清除失敗', error)
  }
}

function loadDebateRecovery(): DebateRecoveryState | null {
  try {
    const raw = localStorage.getItem(DEBATE_RECOVERY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DebateRecoveryState
    if (Date.now() - parsed.timestamp > RECOVERY_TTL_MS) {
      localStorage.removeItem(DEBATE_RECOVERY_KEY)
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
  })) as StoredAttachment[]
}

function useDebateRestore(onRecovered: () => void): void {
  const appliedRef = useRef(false)
  useEffect(() => {
    if (appliedRef.current) return
    appliedRef.current = true
    const store = useDebateStore.getState()
    if (store.messages.length > 0 || store.status !== 'idle' || store.forModel.modelId || store.againstModel.modelId) return

    const saved = loadDebateRecovery()
    const lineup = loadDebateLineup()
    if (lineup) {
      store.setTotalRounds(lineup.totalRounds)
      store.setStartingSide(lineup.startingSide === 'against' ? 'against' : 'for')
      store.setForModel(lineup.forModel)
      store.setAgainstModel(lineup.againstModel)
      lineup.judges.forEach((judge, index) => store.updateJudge(index, judge))
    }
    if (saved) {
      store.setTopic(saved.topic)
      store.setTotalRounds(saved.totalRounds)
      store.setStartingSide(saved.startingSide === 'against' ? 'against' : 'for')
      store.setForModel({ modelId: saved.forModelId, systemPrompt: saved.forSystemPrompt })
      store.setAgainstModel({ modelId: saved.againstModelId, systemPrompt: saved.againstSystemPrompt })
      onRecovered()
    }
  }, [onRecovered])
}

function JudgeSetup({ disabled }: { disabled: boolean }): JSX.Element {
  const judges = useDebateStore((state) => state.judges)
  const updateJudge = useDebateStore((state) => state.updateJudge)
  const [isOpen, setIsOpen] = useState(false)
  const configured = judges.filter((judge) => judge.modelId.trim()).length
  const firstModel = judges.find((judge) => judge.modelId.trim())?.modelId ?? ''

  return (
    <div className="border-t border-line">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-sunken/60"
      >
        <Icon name="scale" className="h-4 w-4 text-muted" />
        <span className="text-[13px] font-medium">裁判團</span>
        <span className="num text-xs text-muted">{configured} / {judges.length} 位已設定</span>
        <Icon name="chevronDown" className={`ml-auto h-3.5 w-3.5 text-muted transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="card-enter space-y-2.5 px-3 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">前三位專科裁判同時評分，綜合裁判最後總結。沒選模型的裁判會略過。</p>
            <button
              type="button"
              disabled={disabled || !firstModel}
              onClick={() => judges.forEach((_, index) => updateJudge(index, { modelId: firstModel }))}
              title={firstModel ? `四位裁判都使用 ${firstModel}` : '請先替一位裁判選模型'}
              className="btn btn-outline !h-8"
            >
              全部用同一個模型
            </button>
          </div>
          <div className="grid gap-x-5 gap-y-2.5 lg:grid-cols-2">
            {judges.map((judge, index) => (
              <div key={judge.name} className="min-w-0">
                <p className="mb-1 text-xs font-medium text-muted">{judge.name}</p>
                <ModelSlot
                  label={judge.name}
                  modelId={judge.modelId}
                  systemPrompt={judge.systemPrompt}
                  disabled={disabled}
                  onModelIdChange={(value) => updateJudge(index, { modelId: value })}
                  onSystemPromptChange={(value) => updateJudge(index, { systemPrompt: value })}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DebateSetup({ disabled, onCollapse }: { disabled: boolean; onCollapse?: () => void }): JSX.Element {
  const store = useDebateStore()
  return (
    <section aria-label="辯論設定" className="panel card-enter">
      <div className="grid md:grid-cols-2">
        <div className="min-w-0 space-y-1.5 p-3">
          <p className="text-[13px] font-medium text-pro">正方</p>
          <ModelSlot
            label="正方模型"
            token={<SideToken side="for" />}
            modelId={store.forModel.modelId}
            systemPrompt={store.forModel.systemPrompt}
            reasoning={store.forModel.reasoning}
            disabled={disabled}
            onModelIdChange={(value) => store.setForModel({ modelId: value })}
            onSystemPromptChange={(value) => store.setForModel({ systemPrompt: value })}
            onReasoningChange={(value) => store.setForModel({ reasoning: value })}
          />
        </div>
        <div className="min-w-0 space-y-1.5 border-t border-line p-3 md:border-l md:border-t-0">
          <p className="text-[13px] font-medium text-con">反方</p>
          <ModelSlot
            label="反方模型"
            token={<SideToken side="against" />}
            modelId={store.againstModel.modelId}
            systemPrompt={store.againstModel.systemPrompt}
            reasoning={store.againstModel.reasoning}
            disabled={disabled}
            onModelIdChange={(value) => store.setAgainstModel({ modelId: value })}
            onSystemPromptChange={(value) => store.setAgainstModel({ systemPrompt: value })}
            onReasoningChange={(value) => store.setAgainstModel({ reasoning: value })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-3 py-2.5">
        <RangeField
          id="debate-rounds"
          label="回合數"
          value={store.totalRounds}
          min={MIN_DEBATE_ROUNDS}
          max={MAX_DEBATE_ROUNDS}
          unit="回合"
          disabled={disabled}
          onChange={store.setTotalRounds}
          className="w-full sm:w-72"
        />
        <div className="flex items-center gap-2.5">
          <span className="field-label">起始方</span>
          <Segmented
            label="起始方"
            value={store.startingSide}
            disabled={disabled}
            options={[{ value: 'for', label: '正方先開始' }, { value: 'against', label: '反方先開始' }]}
            onChange={store.setStartingSide}
          />
        </div>
        {onCollapse && (
          <button type="button" onClick={onCollapse} aria-label="收合設定" title="收合設定" className="icon-btn ml-auto">
            <Icon name="chevronDown" className="h-3.5 w-3.5 rotate-180" />
          </button>
        )}
      </div>
      <JudgeSetup disabled={disabled} />
    </section>
  )
}

function DebateSummary({ onEdit }: { onEdit: () => void }): JSX.Element {
  const forModel = useDebateStore((state) => state.forModel.modelId)
  const againstModel = useDebateStore((state) => state.againstModel.modelId)
  return (
    <div className="panel flex items-center gap-3 py-1.5 pl-3 pr-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SideToken side="for" />
        <ModelName id={forModel} className="min-w-0 flex-1 text-xs" />
        <span className="shrink-0 text-xs text-faint">對</span>
        <SideToken side="against" />
        <ModelName id={againstModel} className="min-w-0 flex-1 text-xs" />
      </div>
      <button type="button" onClick={onEdit} className="btn btn-ghost !h-8">
        編輯設定
        <Icon name="chevronDown" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function DebatePage(): JSX.Element {
  const store = useDebateStore()
  const { apiUrl, apiKey } = useSettingsStore()
  const activeDebateId = useHistoryStore((state) => state.activeDebateId)
  const [recoveryBanner, setRecoveryBanner] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isSetupOpen, setIsSetupOpen] = useState(false)

  useDebateRestore(useCallback(() => setRecoveryBanner(true), []))

  useEffect(() => {
    const snapshot = getDebateRunSnapshot(activeDebateId)
    if (snapshot) useDebateStore.setState(snapshot)
    setIsSetupOpen(false)
    setNotice(null)
    setExportError(null)
  }, [activeDebateId])

  const handleStart = useCallback(() => {
    if (store.status === 'debating' || store.status === 'judging') return
    if (!apiKey) {
      setNotice('還沒有 API Key，請先在上方貼上金鑰。')
      return
    }
    if (!store.forModel.modelId.trim() || !store.againstModel.modelId.trim()) {
      setNotice('請先選好正方和反方的模型。')
      setIsSetupOpen(true)
      return
    }
    if (!store.topic.trim()) {
      setNotice('請輸入辯論議題。')
      return
    }

    setNotice(null)
    setExportError(null)
    setRecoveryBanner(false)
    setIsSetupOpen(false)
    store.resetDebate()
    const initialState = useDebateStore.getState()
    saveDebateLineup({
      totalRounds: initialState.totalRounds,
      startingSide: initialState.startingSide,
      forModel: initialState.forModel,
      againstModel: initialState.againstModel,
      judges: initialState.judges.map((judge) => ({ modelId: judge.modelId, systemPrompt: judge.systemPrompt }))
    })
    const historyId = useHistoryStore.getState().saveDebate({
      title: getHistoryTitle(initialState.topic),
      topic: initialState.topic,
      totalRounds: initialState.totalRounds,
      startingSide: initialState.startingSide,
      forModel: initialState.forModel,
      againstModel: initialState.againstModel,
      attachments: toStoredAttachments(initialState.attachments),
      messages: [],
      status: 'debating',
      currentRound: 0,
      currentSpeaker: null,
      currentStreamText: '',
      currentStreamReasoningText: '',
      judges: initialState.judges.map((judge) => ({
        name: judge.name,
        modelId: judge.modelId,
        systemPrompt: judge.systemPrompt,
        analysis: '',
        reasoningText: '',
        isStreaming: false,
        error: null
      }))
    })
    saveDebateRecovery({
      historyId,
      topic: initialState.topic,
      totalRounds: initialState.totalRounds,
      startingSide: initialState.startingSide,
      forModelId: initialState.forModel.modelId,
      forSystemPrompt: initialState.forModel.systemPrompt,
      againstModelId: initialState.againstModel.modelId,
      againstSystemPrompt: initialState.againstModel.systemPrompt,
      timestamp: Date.now()
    })
    startDebateRun(historyId, {
      apiUrl,
      apiKey,
      state: initialState,
      onCompleted: clearDebateRecovery
    })
  }, [apiKey, apiUrl, store])

  const handleStop = useCallback(() => {
    stopDebateRun(activeDebateId)
  }, [activeDebateId])

  const isActive = store.status === 'debating' || store.status === 'judging'
  const hasDialogue = store.messages.length > 0 || Boolean(store.currentStreamText || store.currentStreamReasoningText) || isActive
  const canExportPdf = store.messages.length > 0 && !isActive

  const handleExportPdf = useCallback(() => {
    if (!canExportPdf) return
    setExportError(null)
    // PDF 程式很大又不常用，按下匯出才載入
    import('@/services/debate-pdf')
      .catch((error: unknown) => {
        console.error('PDF 程式載入失敗', error)
        throw new Error('程式載入不到，請重新整理頁面再試一次。')
      })
      .then(({ downloadDebatePdf }) => downloadDebatePdf({
        topic: store.topic,
        totalRounds: store.totalRounds,
        startingSide: store.startingSide,
        forModel: store.forModel,
        againstModel: store.againstModel,
        messages: store.messages,
        judges: store.judges
      }))
      .catch((error: unknown) => {
        console.error('PDF 匯出失敗', error)
        setExportError(error instanceof Error ? `PDF 匯出失敗：${error.message}` : 'PDF 匯出失敗，請再試一次。')
      })
  }, [canExportPdf, store])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1760px] flex-col gap-3 px-4 pt-4 md:px-6 md:pt-5">
      <h2 className="text-xl font-semibold">AI 辯論</h2>
      <ApiKeyBanner />
      {recoveryBanner && <RecoveryBanner message="已恢復上次未完成的辯論設定，按開始就能重新辯論。" onDismiss={() => setRecoveryBanner(false)} />}

      {!hasDialogue || isSetupOpen
        ? <DebateSetup disabled={isActive} onCollapse={hasDialogue ? () => setIsSetupOpen(false) : undefined} />
        : <DebateSummary onEdit={() => setIsSetupOpen(true)} />}

      {hasDialogue ? (
        <>
          <DebateStatusBar canExport={canExportPdf} exportError={exportError} onExport={handleExportPdf} />
          <DebateRounds />
          <JudgePanel />
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[13px] text-muted">兩個模型一來一往交鋒，裁判團最後評分。試試看：</span>
          {SAMPLE_TOPICS.map((topic) => (
            <button key={topic} type="button" onClick={() => store.setTopic(topic)} className="max-w-full cursor-pointer truncate rounded-full border border-line px-3 py-2.5 text-xs sm:py-1 text-muted transition-colors duration-150 hover:border-line-strong hover:text-ink">
              {topic}
            </button>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 z-20 -mx-1 mt-auto bg-gradient-to-t from-canvas from-70% to-transparent px-1 pb-3 pt-4 md:pb-4">
        <DropZone
          attachments={store.attachments}
          onAdd={store.addAttachment}
          onRemove={store.removeAttachment}
          userInput={store.topic}
          onInputChange={(value) => {
            setNotice(null)
            store.setTopic(value)
          }}
          onSend={handleStart}
          onStop={handleStop}
          isSending={isActive}
          placeholder="輸入辯論議題…"
          sendLabel="開始辯論"
          sendingLabel="辯論中"
          notice={notice}
        />
      </div>
    </div>
  )
}
