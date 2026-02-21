import { useCallback } from 'react'
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

export function ArenaPage(): JSX.Element {
  const store = useArenaStore()
  const { apiUrl, apiKey } = useSettingsStore()

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
    <div className="flex flex-col p-5 gap-4">
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
        store.slotCount === 2 ? 'grid-cols-2' :
        store.slotCount === 3 ? 'grid-cols-3' : 'grid-cols-4'
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

      {/* 回應區 — 固定最小高度，不會被裁判區壓縮 */}
      {hasResponses && (
        <div className={`grid gap-3 ${
          store.slotCount === 2 ? 'grid-cols-2' :
          store.slotCount === 3 ? 'grid-cols-3' : 'grid-cols-4'
        }`}>
          {store.slots.map((slot, index) => (
            <div
              key={slot.id}
              className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden min-h-[200px] max-h-[500px]"
            >
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
                <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                  模型 {String.fromCharCode(65 + index)}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-600 truncate font-mono">
                  {slot.modelId || '未設定'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <StreamingText
                  text={slot.responseText}
                  isStreaming={slot.isStreaming}
                  error={slot.error}
                />
              </div>
            </div>
          ))}
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
                <span className="inline-block w-2 h-4 bg-primary-500 animate-pulse mt-1" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
