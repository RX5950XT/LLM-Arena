import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { useHistoryStore } from '@/stores/history-store'
import { OpenRouterClient } from '@/services/openrouter-client'
import { isProviderRunActive, startProviderRun, stopProviderRun } from '@/services/provider-runner'
import { ModelSlot } from '@/components/shared/ModelSlot'
import { DropZone } from '@/components/shared/DropZone'
import { StreamingText } from '@/components/shared/StreamingText'
import type { Attachment, ProviderEndpoint } from '@/types/models'
import type { ProviderHistoryResponse, StoredAttachment } from '@/types/history'

interface ProviderResponseState {
  responseText: string
  reasoningText: string
  isStreaming: boolean
  error: string | null
}

function formatTokens(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('zh-TW')
}

function formatPrice(value: number | null): string {
  if (value === null) return '—'
  const perMillion = value * 1_000_000
  return perMillion < 0.01 ? `$${perMillion.toExponential(1)}` : `$${perMillion.toFixed(2)}`
}

function emptyResponse(): ProviderResponseState {
  return { responseText: '', reasoningText: '', isStreaming: true, error: null }
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

function fromHistoryResponses(responses: Record<string, ProviderHistoryResponse>, isLiveRun: boolean): Record<string, ProviderResponseState> {
  return Object.fromEntries(Object.entries(responses).map(([slug, response]) => [slug, {
    responseText: response.responseText,
    reasoningText: response.reasoningText ?? '',
    isStreaming: isLiveRun && (response.isStreaming ?? false),
    error: response.error
  }]))
}

export function ProviderComparisonPage(): JSX.Element {
  const { apiUrl, apiKey, isLoaded, modelList } = useSettingsStore()
  const activeProviderId = useHistoryStore((state) => state.activeProviderId)
  const activeProviderEntry = useHistoryStore((state) => state.activeProviderId
    ? state.providerHistory.find((item) => item.id === state.activeProviderId) ?? null
    : null)
  const [modelId, setModelId] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [reasoning, setReasoning] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [endpoints, setEndpoints] = useState<ProviderEndpoint[]>([])
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([])
  const [responses, setResponses] = useState<Record<string, ProviderResponseState>>({})
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [endpointError, setEndpointError] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const endpointRequestRef = useRef<AbortController | null>(null)
  const modelInitializedRef = useRef(false)

  useEffect(() => {
    if (!isLoaded || modelInitializedRef.current) return
    modelInitializedRef.current = true
    setModelId(modelList[0] ?? '')
  }, [isLoaded, modelList])

  useEffect(() => {
    const entry = activeProviderEntry
    if (!entry) {
      setModelId(modelList[0] ?? '')
      setSystemPrompt('')
      setReasoning(false)
      setUserInput('')
      setAttachments([])
      setEndpoints([])
      setSelectedSlugs([])
      setResponses({})
      setEndpointError(null)
      setRunError(null)
      setIsSending(false)
      return
    }

    const isLiveRun = isProviderRunActive(entry.id)
    setModelId(entry.modelId)
    setSystemPrompt(entry.systemPrompt)
    setReasoning(entry.reasoning)
    setUserInput(entry.userInput)
    setAttachments(entry.attachments.filter((attachment) => !attachment.isImagePlaceholder).map(({ isImagePlaceholder: _, ...rest }) => rest))
    setEndpoints(entry.endpoints)
    setSelectedSlugs(entry.selectedSlugs)
    setResponses(fromHistoryResponses(entry.responses, isLiveRun))
    setIsSending(isLiveRun && (entry.isSending ?? Object.values(entry.responses).some((response) => response.isStreaming)))
    setEndpointError(null)
    setRunError(null)
  }, [activeProviderEntry, activeProviderId, modelList])

  useEffect(() => {
    return () => endpointRequestRef.current?.abort()
  }, [])

  const loadEndpoints = useCallback(async () => {
    if (!apiKey) {
      setEndpointError('請先在設定頁面輸入 OpenRouter API Key。')
      return
    }
    if (!modelId.trim()) {
      setEndpointError('請先選擇模型。')
      return
    }

    endpointRequestRef.current?.abort()
    const controller = new AbortController()
    endpointRequestRef.current = controller
    setIsLoadingEndpoints(true)
    setEndpointError(null)
    setEndpoints([])
    setSelectedSlugs([])
    setResponses({})

    try {
      const client = new OpenRouterClient(apiUrl, apiKey)
      const nextEndpoints = await client.getModelEndpoints(modelId, controller.signal)
      if (controller.signal.aborted) return
      setRunError(null)
      setEndpoints(nextEndpoints)
      setSelectedSlugs(nextEndpoints.slice(0, 2).map((endpoint) => endpoint.slug))
      if (nextEndpoints.length === 0) {
        setEndpointError('這個模型目前沒有可用的供應商 endpoint。')
      }
    } catch (err) {
      if (controller.signal.aborted) return
      setEndpointError(err instanceof Error ? err.message : String(err))
    } finally {
      if (endpointRequestRef.current === controller) {
        endpointRequestRef.current = null
        setIsLoadingEndpoints(false)
      }
    }
  }, [apiKey, apiUrl, modelId])

  const toggleProvider = useCallback((slug: string) => {
    setRunError(null)
    setSelectedSlugs((current) => current.includes(slug)
      ? current.filter((item) => item !== slug)
      : [...current, slug])
  }, [])

  const toggleAllProviders = useCallback(() => {
    setRunError(null)
    setSelectedSlugs((current) => current.length === endpoints.length
      ? []
      : endpoints.map((endpoint) => endpoint.slug))
  }, [endpoints])

  const handleStop = useCallback(() => {
    stopProviderRun(activeProviderId)
  }, [activeProviderId])

  const handleCompare = useCallback(() => {
    if (isSending) return
    if (!apiKey) {
      setRunError('請先在設定頁面輸入 OpenRouter API Key。')
      return
    }
    if (!modelId.trim() || !userInput.trim()) {
      setRunError('請選擇模型並輸入問題。')
      return
    }

    const selectedEndpoints = endpoints.filter((endpoint) => selectedSlugs.includes(endpoint.slug))
    if (selectedEndpoints.length === 0) {
      setRunError('請至少選擇 1 個供應商。')
      return
    }

    setRunError(null)
    setIsSending(true)
    const initialResponses = Object.fromEntries(selectedEndpoints.map((endpoint) => [endpoint.slug, emptyResponse()]))
    setResponses(initialResponses)

    const historyId = useHistoryStore.getState().saveProvider({
      title: getHistoryTitle(userInput),
      modelId: modelId.trim(),
      systemPrompt,
      reasoning,
      userInput,
      attachments: toStoredAttachments(attachments),
      endpoints,
      selectedSlugs: selectedEndpoints.map((endpoint) => endpoint.slug),
      responses: initialResponses,
      isSending: true
    })
    startProviderRun(historyId, {
      apiUrl,
      apiKey,
      modelId: modelId.trim(),
      systemPrompt,
      reasoning,
      userInput,
      attachments,
      endpoints,
      selectedSlugs: selectedEndpoints.map((endpoint) => endpoint.slug)
    })
  }, [apiKey, apiUrl, attachments, endpoints, isSending, modelId, reasoning, selectedSlugs, systemPrompt, userInput])

  const allSelected = endpoints.length > 0 && selectedSlugs.length === endpoints.length
  const selectedEndpoints = endpoints.filter((endpoint) => selectedSlugs.includes(endpoint.slug))

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 p-4 md:p-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">OpenRouter 供應商比較</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            固定同一個模型與問題，分別送到不同供應商，直接看回應、速度與價格差異。
          </p>
        </div>
        <span className="w-fit rounded-full bg-primary-500/10 px-2.5 py-1 text-xs font-medium text-primary-700 dark:text-primary-300">
          同模型 · 多供應商
        </span>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">先設定比較條件</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">模型和問題固定，差異才會來自供應商。</p>
          </div>

          <div className="space-y-4">
            <ModelSlot
              label="比較模型"
              modelId={modelId}
              systemPrompt={systemPrompt}
              reasoning={reasoning}
              showPromptLibrary
              onModelIdChange={(value) => {
                setModelId(value)
                setEndpoints([])
                setSelectedSlugs([])
                setResponses({})
                setEndpointError(null)
              }}
              onSystemPromptChange={setSystemPrompt}
              onReasoningChange={setReasoning}
            />

            <button
              type="button"
              onClick={loadEndpoints}
              disabled={isLoadingEndpoints || isSending || !modelId.trim()}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary-600 px-3 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 dark:border-primary-500 dark:text-primary-300 dark:hover:bg-primary-950/30 dark:disabled:border-slate-700 dark:disabled:text-slate-600"
            >
              {isLoadingEndpoints && (
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                </svg>
              )}
              {isLoadingEndpoints ? '正在查詢供應商...' : '查詢可用供應商'}
            </button>

            <DropZone
              attachments={attachments}
              onAdd={(attachment) => setAttachments((current) => [...current, attachment])}
              onRemove={(id) => setAttachments((current) => current.filter((attachment) => attachment.id !== id))}
              userInput={userInput}
              onInputChange={setUserInput}
              onSend={handleCompare}
              onStop={handleStop}
              isSending={isSending}
              placeholder="輸入要比較的問題..."
            />
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">選擇供應商</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">每個勾選項目會獨立發送一次，選 1 家也可以查看單一回應。</p>
            </div>
            {endpoints.length > 0 && (
              <button
                type="button"
                onClick={toggleAllProviders}
                disabled={isSending}
                className="shrink-0 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-primary-400 dark:hover:text-primary-300"
              >
                {allSelected ? '全部取消' : '全部選取'}
              </button>
            )}
          </div>

          {endpointError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-400">
              {endpointError}
            </div>
          )}

          {isLoadingEndpoints && (
            <div className="space-y-2" aria-label="載入供應商">
              {[1, 2, 3].map((item) => <div key={item} className="h-[68px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}
            </div>
          )}

          {!isLoadingEndpoints && endpoints.length === 0 && !endpointError && (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              先查詢模型，這裡會列出它可用的供應商。
            </div>
          )}

          {!isLoadingEndpoints && endpoints.length > 0 && (
            <div className="max-h-[min(42vh,28rem)] space-y-2 overflow-y-auto pr-1">
              {endpoints.map((endpoint) => {
                const selected = selectedSlugs.includes(endpoint.slug)
                return (
                  <label
                    key={endpoint.slug}
                    className={`flex min-h-[68px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                      selected
                        ? 'border-primary-500/60 bg-primary-50/70 dark:border-primary-500/50 dark:bg-primary-950/20'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleProvider(endpoint.slug)}
                      disabled={isSending}
                      className="h-4 w-4 shrink-0 accent-primary-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">{endpoint.name}</span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">{endpoint.slug}</span>
                    </span>
                    <span className="hidden shrink-0 text-right text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 sm:block">
                      <span className="block">上下文 {formatTokens(endpoint.contextLength)}</span>
                      <span className="block">入 {formatPrice(endpoint.promptPrice)} · 出 {formatPrice(endpoint.completionPrice)} / 1M</span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}

          {endpoints.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">已選 {selectedSlugs.length} / {endpoints.length}</span>
              <button
                type="button"
                onClick={handleCompare}
                disabled={isSending || selectedSlugs.length === 0 || !userInput.trim()}
                className="min-h-10 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
              >
                {isSending ? '比較生成中...' : '開始比較'}
              </button>
            </div>
          )}
          {runError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{runError}</p>}
        </section>
      </div>

      {selectedEndpoints.length > 0 && Object.keys(responses).length > 0 && (
        <section aria-live="polite" className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">回應比較</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">思考內容預設收起，點開即可查看。</p>
            </div>
            <span className="shrink-0 text-xs font-mono text-slate-400 dark:text-slate-500">{selectedEndpoints.length} providers</span>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {selectedEndpoints.map((endpoint) => {
              const response = responses[endpoint.slug]
              if (!response) return null
              return (
                <article key={endpoint.slug} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <header className="flex min-h-[60px] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/80">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">{endpoint.name}</span>
                      <span className="block truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">{endpoint.slug}</span>
                    </span>
                    {!response.isStreaming && !response.error && <span className="text-xs text-emerald-600 dark:text-emerald-400">完成</span>}
                  </header>
                  <div className="max-h-[min(60vh,36rem)] min-h-[220px] overflow-y-auto p-3">
                    <StreamingText
                      text={response.responseText}
                      reasoningText={response.reasoningText}
                      isStreaming={response.isStreaming}
                      error={response.error}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
