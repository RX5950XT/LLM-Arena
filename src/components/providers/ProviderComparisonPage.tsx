import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { useHistoryStore } from '@/stores/history-store'
import { OpenRouterClient } from '@/services/openrouter-client'
import { isProviderRunActive, startProviderRun, stopProviderRun } from '@/services/provider-runner'
import { ApiKeyBanner, ModelName, Segmented } from '@/components/shared/controls'
import { DropZone } from '@/components/shared/DropZone'
import { Icon, Spinner } from '@/components/shared/icons'
import { ModelSlot } from '@/components/shared/ModelSlot'
import { ResponseCard, responseGridClass, useResponseLayout } from '@/components/shared/ResponseCard'
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
  if (perMillion === 0) return '免費'
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

/** 輸入加輸出單價最低的供應商；只有一家或價格都一樣時不標示。 */
function findCheapestSlugs(endpoints: ProviderEndpoint[]): Set<string> {
  const priced = endpoints.flatMap((endpoint) =>
    endpoint.promptPrice !== null && endpoint.completionPrice !== null
      ? [{ slug: endpoint.slug, total: endpoint.promptPrice + endpoint.completionPrice }]
      : []
  )
  if (priced.length < 2) return new Set()
  const lowest = Math.min(...priced.map((entry) => entry.total))
  if (priced.every((entry) => entry.total === lowest)) return new Set()
  return new Set(priced.filter((entry) => entry.total === lowest).map((entry) => entry.slug))
}

function EndpointTable({ endpoints, selectedSlugs, disabled, onToggle, onToggleAll }: {
  endpoints: ProviderEndpoint[]
  selectedSlugs: string[]
  disabled: boolean
  onToggle: (slug: string) => void
  onToggleAll: () => void
}): JSX.Element {
  const cheapest = useMemo(() => findCheapestSlugs(endpoints), [endpoints])
  const allSelected = selectedSlugs.length === endpoints.length

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-1 pb-1.5">
        <span className="num text-xs text-muted">已選 {selectedSlugs.length} / {endpoints.length} 家，每家各送一次</span>
        <button type="button" onClick={onToggleAll} disabled={disabled} className="btn btn-ghost !h-7 !px-2 !text-xs">
          {allSelected ? '全部取消' : '全部選取'}
        </button>
      </div>
      <div className="hidden grid-cols-[1.25rem_minmax(0,1fr)_6rem_5rem_5rem] gap-3 border-b border-line px-2.5 pb-1.5 text-[11px] font-medium text-faint sm:grid">
        <span />
        <span>供應商</span>
        <span className="text-right">上下文</span>
        <span className="text-right">輸入 / 1M</span>
        <span className="text-right">輸出 / 1M</span>
      </div>
      <div className="max-h-[min(42vh,26rem)] space-y-px overflow-y-auto pt-1">
        {endpoints.map((endpoint) => {
          const selected = selectedSlugs.includes(endpoint.slug)
          return (
            <label
              key={endpoint.slug}
              className={`grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-3 rounded-lg px-2.5 py-2 transition-colors duration-150 sm:grid-cols-[1.25rem_minmax(0,1fr)_6rem_5rem_5rem] ${
                selected ? 'bg-accent/10' : 'hover:bg-sunken'
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(endpoint.slug)}
                disabled={disabled}
                className="h-4 w-4 accent-[rgb(var(--accent))]"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium">{endpoint.name}</span>
                  {cheapest.has(endpoint.slug) && (
                    <span className="shrink-0 rounded bg-accent/15 px-1 text-[11px] font-medium text-accent-text">最便宜</span>
                  )}
                </span>
                <span className="block truncate font-mono text-[11px] text-faint">{endpoint.slug}</span>
              </span>
              <span className="num col-start-2 mt-0.5 text-xs text-muted sm:col-start-auto sm:mt-0 sm:text-right">
                <span className="sm:hidden">上下文 </span>{formatTokens(endpoint.contextLength)}
              </span>
              <span className="num col-start-2 text-xs text-muted sm:col-start-auto sm:text-right">
                <span className="sm:hidden">輸入 </span>{formatPrice(endpoint.promptPrice)}
              </span>
              <span className="num col-start-2 text-xs text-muted sm:col-start-auto sm:text-right">
                <span className="sm:hidden">輸出 </span>{formatPrice(endpoint.completionPrice)}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
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
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [collapsedSlugs, setCollapsedSlugs] = useState<Set<string>>(new Set())
  const [layout, setLayout] = useResponseLayout()
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
    setIsSetupOpen(false)
    setCollapsedSlugs(new Set())
  }, [activeProviderId])

  useEffect(() => {
    return () => endpointRequestRef.current?.abort()
  }, [])

  const loadEndpoints = useCallback(async (targetModel: string) => {
    if (!apiKey) {
      setEndpointError('請先在上方貼上 OpenRouter API Key。')
      return
    }
    if (!targetModel.trim()) {
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
      const nextEndpoints = await client.getModelEndpoints(targetModel, controller.signal)
      if (controller.signal.aborted) return
      setRunError(null)
      setEndpoints(nextEndpoints)
      setSelectedSlugs(nextEndpoints.slice(0, 2).map((endpoint) => endpoint.slug))
      if (nextEndpoints.length === 0) {
        setEndpointError('這個模型目前沒有可用的供應商，換一個模型試試看。')
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
  }, [apiKey, apiUrl])

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
      setRunError('還沒有 API Key，請先在上方貼上金鑰。')
      return
    }
    if (!modelId.trim() || !userInput.trim()) {
      setRunError('請選擇模型並輸入問題。')
      return
    }

    const chosen = endpoints.filter((endpoint) => selectedSlugs.includes(endpoint.slug))
    if (chosen.length === 0) {
      setRunError(endpoints.length === 0 ? '請先查詢這個模型的供應商。' : '請至少勾選 1 個供應商。')
      return
    }

    setRunError(null)
    setIsSending(true)
    setIsSetupOpen(false)
    setCollapsedSlugs(new Set())
    const initialResponses = Object.fromEntries(chosen.map((endpoint) => [endpoint.slug, emptyResponse()]))
    setResponses(initialResponses)

    const historyId = useHistoryStore.getState().saveProvider({
      title: getHistoryTitle(userInput),
      modelId: modelId.trim(),
      systemPrompt,
      reasoning,
      userInput,
      attachments: toStoredAttachments(attachments),
      endpoints,
      selectedSlugs: chosen.map((endpoint) => endpoint.slug),
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
      selectedSlugs: chosen.map((endpoint) => endpoint.slug)
    })
  }, [apiKey, apiUrl, attachments, endpoints, isSending, modelId, reasoning, selectedSlugs, systemPrompt, userInput])

  const selectedEndpoints = endpoints.filter((endpoint) => selectedSlugs.includes(endpoint.slug))
  const hasResponses = selectedEndpoints.length > 0 && Object.keys(responses).length > 0
  const showSetup = !hasResponses || isSetupOpen
  const doneCount = selectedEndpoints.filter((endpoint) => responses[endpoint.slug] && !responses[endpoint.slug].isStreaming).length

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1760px] flex-col gap-3 px-4 pt-4 md:px-6 md:pt-5">
      <header>
        <h2 className="text-xl font-semibold">供應商比較</h2>
        <p className="mt-0.5 text-[13px] text-muted">同一個模型、同一個問題，送到不同供應商，比回應、速度與價格。</p>
      </header>
      <ApiKeyBanner />

      {showSetup ? (
        <section aria-label="比較條件" className="panel card-enter">
          <div className="flex items-start gap-2 p-3">
            <div className="min-w-0 flex-1">
              <ModelSlot
                label="比較模型"
                modelId={modelId}
                systemPrompt={systemPrompt}
                reasoning={reasoning}
                disabled={isSending}
                showPromptLibrary
                onModelIdChange={(value) => {
                  setModelId(value)
                  setEndpoints([])
                  setSelectedSlugs([])
                  setResponses({})
                  setEndpointError(null)
                }}
                onModelPick={(value) => void loadEndpoints(value)}
                onModelEnter={() => void loadEndpoints(modelId)}
                onSystemPromptChange={setSystemPrompt}
                onReasoningChange={setReasoning}
              />
            </div>
            <button
              type="button"
              onClick={() => void loadEndpoints(modelId)}
              disabled={isLoadingEndpoints || isSending || !modelId.trim()}
              aria-label={isLoadingEndpoints ? '查詢中' : '查詢供應商'}
              title={isLoadingEndpoints ? '查詢中' : '查詢供應商'}
              className="btn btn-outline"
            >
              {isLoadingEndpoints ? <Spinner /> : <Icon name="search" />}
              <span className="hidden sm:inline">{isLoadingEndpoints ? '查詢中' : '查詢供應商'}</span>
            </button>
            {hasResponses && (
              <button type="button" onClick={() => setIsSetupOpen(false)} aria-label="收合條件" title="收合條件" className="icon-btn !h-9 !w-9">
                <Icon name="chevronDown" className="h-3.5 w-3.5 rotate-180" />
              </button>
            )}
          </div>

          <div className="border-t border-line p-3">
            {endpointError && (
              <div role="alert" className="mb-2 rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{endpointError}</div>
            )}
            {isLoadingEndpoints && (
              <div className="space-y-2" aria-label="載入供應商">
                {[1, 2, 3].map((item) => <div key={item} className="skeleton h-11 rounded-lg" />)}
              </div>
            )}
            {!isLoadingEndpoints && endpoints.length === 0 && !endpointError && (
              <p className="py-2 text-[13px] text-muted">選好模型後按「查詢供應商」，這裡會列出每家的上下文長度與價格。</p>
            )}
            {!isLoadingEndpoints && endpoints.length > 0 && (
              <EndpointTable
                endpoints={endpoints}
                selectedSlugs={selectedSlugs}
                disabled={isSending}
                onToggle={toggleProvider}
                onToggleAll={toggleAllProviders}
              />
            )}
          </div>
        </section>
      ) : (
        <div className="panel flex items-center gap-2 py-1.5 pl-3 pr-1.5">
          <ModelName id={modelId} className="min-w-0 text-xs" />
          <span className="num flex-1 whitespace-nowrap text-xs text-muted">· {selectedEndpoints.length} 家供應商</span>
          <button type="button" onClick={() => setIsSetupOpen(true)} className="btn btn-ghost !h-8">
            編輯條件
            <Icon name="chevronDown" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {hasResponses && (
        <section aria-label="供應商回應" className="flex flex-col gap-3 pt-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">回應</h3>
            <span className="num text-xs text-muted">{doneCount} / {selectedEndpoints.length} 完成</span>
            <div className="ml-auto">
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
            {selectedEndpoints.map((endpoint) => {
              const response = responses[endpoint.slug]
              if (!response) return null
              return (
                <ResponseCard
                  key={endpoint.slug}
                  title={endpoint.name}
                  caption={endpoint.slug}
                  attempts={[response]}
                  layout={layout}
                  isCollapsed={collapsedSlugs.has(endpoint.slug)}
                  onToggleCollapse={() => setCollapsedSlugs((current) => {
                    const next = new Set(current)
                    if (next.has(endpoint.slug)) next.delete(endpoint.slug)
                    else next.add(endpoint.slug)
                    return next
                  })}
                />
              )
            })}
          </div>
        </section>
      )}

      <div className="sticky bottom-0 z-20 -mx-1 mt-auto bg-gradient-to-t from-canvas from-70% to-transparent px-1 pb-3 pt-4 md:pb-4">
        <DropZone
          attachments={attachments}
          onAdd={(attachment) => setAttachments((current) => [...current, attachment])}
          onRemove={(id) => setAttachments((current) => current.filter((attachment) => attachment.id !== id))}
          userInput={userInput}
          onInputChange={(value) => {
            setRunError(null)
            setUserInput(value)
          }}
          onSend={handleCompare}
          onStop={handleStop}
          isSending={isSending}
          placeholder="輸入要比較的問題…"
          sendLabel="開始比較"
          sendingLabel="比較中"
          notice={runError}
        />
      </div>
    </div>
  )
}
