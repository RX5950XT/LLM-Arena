import { useCallback, useEffect, useRef, useState } from 'react'
import { useArenaStore } from '@/stores/arena-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useHistoryStore } from '@/stores/history-store'
import { OpenRouterClient } from '@/services/openrouter-client'
import { StreamingManager } from '@/services/streaming-manager'
import { buildContentParts } from '@/services/file-handler'
import { generateTitle } from '@/services/title-generator'
import type { ChatMessage } from '@/types/models'
import type { StreamTask } from '@/services/streaming-manager'
import type { StoredAttachment } from '@/types/history'
import { ModelSlot } from '@/components/shared/ModelSlot'
import { DropZone } from '@/components/shared/DropZone'
import { StreamingText } from '@/components/shared/StreamingText'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'

const RECOVERY_KEY = 'arena-recovery-state'
const RECOVERY_TTL_MS = 15 * 60 * 1000

interface RecoveryState {
  userInput: string
  slotCount: number
  slots: Array<{ modelId: string; systemPrompt: string; reasoning: boolean }>
  judgeModelId: string
  judgeSystemPrompt: string
  timestamp: number
}

function saveRecoveryState(state: RecoveryState): void {
  try {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(state))
  } catch {
    // localStorage unavailable
  }
}

function clearRecoveryState(): void {
  try {
    localStorage.removeItem(RECOVERY_KEY)
  } catch {
    // ignore
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

export function ArenaPage(): JSX.Element {
  const store = useArenaStore()
  const { apiUrl, apiKey } = useSettingsStore()
  const [collapsedSlots, setCollapsedSlots] = useState<Set<number>>(new Set())
  const [recoveryBanner, setRecoveryBanner] = useState(false)
  const recoveryAppliedRef = useRef(false)

  useEffect(() => {
    if (recoveryAppliedRef.current) return
    recoveryAppliedRef.current = true
    const saved = loadRecoveryState()
    if (!saved) return
    const hasActive = store.slots.some((s) => s.responseText || s.isStreaming)
    if (hasActive) return
    store.setSlotCount(saved.slotCount)
    saved.slots.forEach((s, i) => store.updateSlot(i, s))
    store.setUserInput(saved.userInput)
    store.setJudgeModelId(saved.judgeModelId)
    store.setJudgeSystemPrompt(saved.judgeSystemPrompt)
    setRecoveryBanner(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCollapse = useCallback((index: number) => {
    setCollapsedSlots((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const handleSend = useCallback(async () => {
    if (!store.userInput.trim() || store.isSending) return
    if (!apiKey) {
      alert('請先在設定頁面輸入 API Key')
      return
    }

    const validSlots = store.slots.filter((s) => s.modelId.trim())
    if (validSlots.length < 2) {
      alert('請至少設定 2 個模型 ID')
      return
    }

    setRecoveryBanner(false)
    saveRecoveryState({
      userInput: store.userInput,
      slotCount: store.slotCount,
      slots: store.slots.map((s) => ({ modelId: s.modelId, systemPrompt: s.systemPrompt, reasoning: s.reasoning ?? false })),
      judgeModelId: store.judgeModelId,
      judgeSystemPrompt: store.judgeSystemPrompt,
      timestamp: Date.now()
    })
    setCollapsedSlots(new Set())
    store.resetResponses()
    store.setIsSending(true)

    const client = new OpenRouterClient(apiUrl, apiKey)
    const manager = new StreamingManager(client)

    const userContent = buildContentParts(store.userInput, store.attachments)

    const tasks: StreamTask[] = validSlots.map((slot, index) => {
      const messages: ChatMessage[] = []
      if (slot.systemPrompt) {
        messages.push({ role: 'system', content: slot.systemPrompt })
      }
      messages.push({ role: 'user', content: userContent })

      store.updateSlot(index, { isStreaming: true })

      return {
        id: slot.id,
        modelId: slot.modelId,
        messages,
        options: { reasoning: slot.reasoning ?? false },
        callbacks: {
          onToken: (token) => store.appendToken(index, token),
          onComplete: () => store.updateSlot(index, { isStreaming: false }),
          onError: (err) =>
            store.updateSlot(index, { isStreaming: false, error: err.message })
        }
      }
    })

    await manager.streamAll(tasks)

    // 裁判自動分析
    if (store.judgeModelId.trim()) {
      store.setIsJudging(true)
      const currentState = useArenaStore.getState()
      const responseSummary = currentState.slots
        .filter((s) => s.modelId.trim())
        .map((s, i) => `## 模型 ${String.fromCharCode(65 + i)}（${s.modelId}）\n${s.responseText}`)
        .join('\n\n---\n\n')

      const judgeUserContent = buildContentParts(
        `使用者問題：${store.userInput}\n\n以下是各模型的回應：\n\n${responseSummary}\n\n請進行評比分析。`,
        currentState.attachments
      )
      const judgeMessages: ChatMessage[] = [
        { role: 'system', content: currentState.judgeSystemPrompt },
        { role: 'user', content: judgeUserContent }
      ]

      try {
        let judgeText = ''
        await client.streamChat(currentState.judgeModelId, judgeMessages, {
          onToken: (token) => {
            judgeText += token
            useArenaStore.getState().setJudgeResult(judgeText)
          },
          onComplete: (text) => {
            useArenaStore.getState().setJudgeResult(text)
            useArenaStore.getState().setIsJudging(false)
          },
          onError: (err) => {
            useArenaStore.getState().setJudgeResult(`評審錯誤: ${err.message}`)
            useArenaStore.getState().setIsJudging(false)
          }
        })
      } catch {
        store.setIsJudging(false)
      }
    }

    store.setIsSending(false)
    clearRecoveryState()

    // 背景：生成標題並儲存歷史紀錄
    void (async () => {
      const finalState = useArenaStore.getState()
      const settings = useSettingsStore.getState()
      const title = await generateTitle(
        settings.apiUrl,
        settings.apiKey,
        settings.titleModelId,
        finalState.userInput,
        finalState.attachments
      )
      const storedAttachments: StoredAttachment[] = finalState.attachments.map((a) => ({
        ...a,
        content: a.type === 'image' ? '' : a.content,
        isImagePlaceholder: a.type === 'image'
      }))
      useHistoryStore.getState().saveArena({
        title,
        slotCount: finalState.slotCount,
        slots: finalState.slots.map((s) => ({
          id: s.id,
          modelId: s.modelId,
          systemPrompt: s.systemPrompt,
          reasoning: s.reasoning ?? false,
          responseText: s.responseText,
          error: s.error
        })),
        userInput: finalState.userInput,
        attachments: storedAttachments,
        judgeModelId: finalState.judgeModelId,
        judgeSystemPrompt: finalState.judgeSystemPrompt,
        judgeResult: finalState.judgeResult
      })
    })()
  }, [store, apiUrl, apiKey])

  const hasResponses = store.slots.some((s) => s.responseText || s.isStreaming)

  return (
    <div className="flex flex-col p-4 md:p-5 gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">模型競技場</h2>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">模型數量</span>
          {[2, 3, 4].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => store.setSlotCount(n)}
              className={`w-8 h-8 text-sm rounded-lg transition-colors cursor-pointer font-mono font-medium ${
                store.slotCount === n
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* 模型設定列 */}
      <div className={`grid gap-3 ${
        store.slotCount === 2 ? 'grid-cols-1 sm:grid-cols-2' :
        store.slotCount === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
      }`}>
        {store.slots.map((slot, index) => (
          <ModelSlot
            key={slot.id}
            label={`模型 ${String.fromCharCode(65 + index)}`}
            modelId={slot.modelId}
            systemPrompt={slot.systemPrompt}
            reasoning={slot.reasoning}
            onModelIdChange={(v) => store.updateSlot(index, { modelId: v })}
            onSystemPromptChange={(v) => store.updateSlot(index, { systemPrompt: v })}
            onReasoningChange={(v) => store.updateSlot(index, { reasoning: v })}
          />
        ))}
      </div>

      {/* 中斷恢復提示 */}
      {recoveryBanner && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm text-amber-700 dark:text-amber-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span className="flex-1">已恢復上次未完成的設定，點擊發送即可重新生成。</span>
          <button type="button" onClick={() => setRecoveryBanner(false)} className="shrink-0 text-amber-500 hover:text-amber-700 dark:hover:text-amber-200 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      )}

      {/* 輸入區 */}
      <DropZone
        attachments={store.attachments}
        onAdd={store.addAttachment}
        onRemove={store.removeAttachment}
        userInput={store.userInput}
        onInputChange={store.setUserInput}
        onSend={handleSend}
        isSending={store.isSending}
      />

      {/* 回應區 */}
      {hasResponses && (
        <div className={`grid gap-3 ${
          store.slotCount === 2 ? 'grid-cols-1 sm:grid-cols-2' :
          store.slotCount === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
        }`}>
          {store.slots.map((slot, index) => {
            const isCollapsed = collapsedSlots.has(index)
            return (
              <div
                key={slot.id}
                className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
              >
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                    模型 {String.fromCharCode(65 + index)}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-600 truncate font-mono flex-1">
                    {slot.modelId || '未設定'}
                  </span>
                  {slot.isStreaming && (
                    <svg className="animate-spin w-3 h-3 text-primary-500 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleCollapse(index)}
                    className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                    title={isCollapsed ? '展開' : '折疊'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="overflow-y-auto p-3 min-h-[200px] max-h-[500px]">
                    <StreamingText
                      text={slot.responseText}
                      isStreaming={slot.isStreaming}
                      error={slot.error}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 裁判區 */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z" />
          </svg>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">裁判模型</span>
        </div>
        <div className="p-4 space-y-3">
          <ModelSlot
            label="裁判"
            modelId={store.judgeModelId}
            systemPrompt={store.judgeSystemPrompt}
            onModelIdChange={store.setJudgeModelId}
            onSystemPromptChange={store.setJudgeSystemPrompt}
          />
          {store.judgeResult && (
            <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 max-h-[500px] overflow-y-auto">
              <MarkdownRenderer content={store.judgeResult} />
              {store.isJudging && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mt-2">
                  <svg className="animate-spin w-3 h-3 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  評審中
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
