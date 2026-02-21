import { useCallback, useRef } from 'react'
import { useDebateStore } from '@/stores/debate-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useHistoryStore } from '@/stores/history-store'
import { OpenRouterClient } from '@/services/openrouter-client'
import { DebateOrchestrator } from '@/services/debate-orchestrator'
import { generateTitle } from '@/services/title-generator'
import { ModelSlot } from '@/components/shared/ModelSlot'
import { DropZone } from '@/components/shared/DropZone'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'
import { MIN_DEBATE_ROUNDS, MAX_DEBATE_ROUNDS } from '@/constants/config'
import type { StoredAttachment } from '@/types/history'

export function DebatePage(): JSX.Element {
  const store = useDebateStore()
  const { apiUrl, apiKey } = useSettingsStore()
  const orchestratorRef = useRef<DebateOrchestrator | null>(null)

  const handleStart = useCallback(async () => {
    if (!apiKey) {
      alert('請先在設定頁面輸入 API Key')
      return
    }
    if (!store.forModel.modelId.trim() || !store.againstModel.modelId.trim()) {
      alert('請設定正方和反方的模型 ID')
      return
    }
    if (!store.topic.trim()) {
      alert('請輸入辯論議題')
      return
    }

    store.resetDebate()
    const client = new OpenRouterClient(apiUrl, apiKey)
    orchestratorRef.current = new DebateOrchestrator(client)
    await orchestratorRef.current.startDebate()

    // 背景：生成標題並儲存歷史紀錄
    void (async () => {
      const finalState = useDebateStore.getState()
      if (finalState.messages.length === 0) return
      const settings = useSettingsStore.getState()
      const title = await generateTitle(
        settings.apiUrl,
        settings.apiKey,
        settings.titleModelId,
        finalState.topic,
        finalState.attachments
      )
      const storedAttachments: StoredAttachment[] = finalState.attachments.map((a) => ({
        ...a,
        content: a.type === 'image' ? '' : a.content,
        isImagePlaceholder: a.type === 'image'
      }))
      useHistoryStore.getState().saveDebate({
        title,
        topic: finalState.topic,
        totalRounds: finalState.totalRounds,
        forModel: finalState.forModel,
        againstModel: finalState.againstModel,
        attachments: storedAttachments,
        messages: finalState.messages,
        judges: finalState.judges.map((j) => ({
          name: j.name,
          modelId: j.modelId,
          systemPrompt: j.systemPrompt,
          analysis: j.analysis
        }))
      })
    })()
  }, [store, apiUrl, apiKey])

  const handleStop = useCallback(() => {
    orchestratorRef.current?.stop()
  }, [])

  const isActive = store.status === 'debating' || store.status === 'judging'
  const hasDialogue = store.messages.length > 0 || store.currentStreamText

  return (
    <div className="flex flex-col p-5 gap-4">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">AI 辯論</h2>

      {/* 設定區 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider font-mono">正方</span>
          </div>
          <ModelSlot
            label="正方模型"
            modelId={store.forModel.modelId}
            systemPrompt={store.forModel.systemPrompt}
            reasoning={store.forModel.reasoning}
            onModelIdChange={(v) => store.setForModel({ modelId: v })}
            onSystemPromptChange={(v) => store.setForModel({ systemPrompt: v })}
            onReasoningChange={(v) => store.setForModel({ reasoning: v })}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 rounded-full bg-red-500" />
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider font-mono">反方</span>
          </div>
          <ModelSlot
            label="反方模型"
            modelId={store.againstModel.modelId}
            systemPrompt={store.againstModel.systemPrompt}
            reasoning={store.againstModel.reasoning}
            onModelIdChange={(v) => store.setAgainstModel({ modelId: v })}
            onSystemPromptChange={(v) => store.setAgainstModel({ systemPrompt: v })}
            onReasoningChange={(v) => store.setAgainstModel({ reasoning: v })}
          />
        </div>
      </div>

      {/* 議題與回合設定 */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <DropZone
            attachments={store.attachments}
            onAdd={store.addAttachment}
            onRemove={store.removeAttachment}
            userInput={store.topic}
            onInputChange={store.setTopic}
            onSend={handleStart}
            isSending={isActive}
            placeholder="輸入辯論議題..."
          />
        </div>
        <div className="shrink-0 space-y-1.5 pb-1">
          <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block">回合數</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              title="辯論回合數"
              min={MIN_DEBATE_ROUNDS}
              max={MAX_DEBATE_ROUNDS}
              value={store.totalRounds}
              onChange={(e) => store.setTotalRounds(Number(e.target.value))}
              className="w-24 accent-primary-500"
              disabled={isActive}
            />
            <span className="text-sm font-mono w-6 text-center text-slate-700 dark:text-slate-300">{store.totalRounds}</span>
          </div>
        </div>
      </div>

      {/* 控制列 */}
      {isActive && (
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {store.status === 'debating' && (
              <>
                第 {store.currentRound}/{store.totalRounds} 回合
                {store.currentSpeaker && (
                  <span className={store.currentSpeaker === 'for' ? ' text-blue-500 font-medium' : ' text-red-500 font-medium'}>
                    {' '}— {store.currentSpeaker === 'for' ? '正方' : '反方'}發言中
                  </span>
                )}
              </>
            )}
            {store.status === 'judging' && '裁判評分中...'}
          </div>
          <button
            type="button"
            onClick={handleStop}
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            停止
          </button>
        </div>
      )}

      {/* 辯論對話區 — 固定高度，不被裁判區壓縮 */}
      {hasDialogue && (
        <div className="grid grid-cols-2 gap-3">
          {/* 正方對話 */}
          <div className="h-[500px] flex flex-col border border-blue-200 dark:border-blue-900/50 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-900/50 flex items-center gap-2 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 font-mono">正方</span>
              <span className="text-xs text-blue-400 dark:text-blue-600 truncate font-mono">{store.forModel.modelId}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {store.messages
                .filter((m) => m.side === 'for')
                .map((msg, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="text-xs text-blue-400 dark:text-blue-600 font-mono">第 {msg.round} 回合</div>
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg p-3">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  </div>
                ))}
              {store.currentSpeaker === 'for' && store.currentStreamText && (
                <div className="space-y-1">
                  <div className="text-xs text-blue-400 dark:text-blue-600 font-mono">第 {store.currentRound} 回合</div>
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg p-3">
                    <MarkdownRenderer content={store.currentStreamText} />
                    <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 反方對話 */}
          <div className="h-[500px] flex flex-col border border-red-200 dark:border-red-900/50 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50 flex items-center gap-2 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-300 font-mono">反方</span>
              <span className="text-xs text-red-400 dark:text-red-600 truncate font-mono">{store.againstModel.modelId}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {store.messages
                .filter((m) => m.side === 'against')
                .map((msg, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="text-xs text-red-400 dark:text-red-600 font-mono">第 {msg.round} 回合</div>
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-lg p-3">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  </div>
                ))}
              {store.currentSpeaker === 'against' && store.currentStreamText && (
                <div className="space-y-1">
                  <div className="text-xs text-red-400 dark:text-red-600 font-mono">第 {store.currentRound} 回合</div>
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-lg p-3">
                    <MarkdownRenderer content={store.currentStreamText} />
                    <span className="inline-block w-1.5 h-4 bg-red-500 animate-pulse ml-0.5" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 裁判區 */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z" />
          </svg>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">裁判團（4 位）</span>
        </div>
        <div className="grid grid-cols-2 gap-3 p-3">
          {store.judges.map((judge, index) => (
            <div key={index} className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="p-3">
                <ModelSlot
                  label={judge.name}
                  modelId={judge.modelId}
                  systemPrompt={judge.systemPrompt}
                  onModelIdChange={(v) => store.updateJudge(index, { modelId: v })}
                  onSystemPromptChange={(v) => store.updateJudge(index, { systemPrompt: v })}
                />
              </div>
              {judge.analysis && (
                <div className="border-t border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-900/50 max-h-[300px] overflow-y-auto">
                  <MarkdownRenderer content={judge.analysis} />
                  {judge.isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary-500 animate-pulse mt-1" />
                  )}
                </div>
              )}
              {judge.error && (
                <div className="border-t border-slate-200 dark:border-slate-800 p-3 text-xs text-red-500">
                  {judge.error}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
