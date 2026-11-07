import { useState, useEffect, useRef } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { useHistoryStore } from '@/stores/history-store'
import { processDroppedFiles } from '@/services/file-handler'
import { Icon } from '@/components/shared/icons'
import { ModelName } from '@/components/shared/controls'
import { ModelCombobox } from '@/components/shared/ModelCombobox'
import type { HistoryExport } from '@/types/history'
import type { SystemPrompt } from '@/types/models'

function Section({ title, description, aside, children }: {
  title: string
  description?: string
  aside?: React.ReactNode
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function SettingsPage(): JSX.Element {
  const {
    apiUrl, apiKey, modelList, systemPrompts, titleModelId,
    setApiUrl, setApiKey, setTitleModelId, addModel, removeModel,
    addSystemPrompts, removeSystemPrompt, loadSettings
  } = useSettingsStore()
  const historyStore = useHistoryStore()
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [newModelId, setNewModelId] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [promptImportError, setPromptImportError] = useState<string | null>(null)
  const [promptImportNotice, setPromptImportNotice] = useState<string | null>(null)
  const [isPromptDragging, setIsPromptDragging] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const promptFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  const showSaved = (): void => {
    setSaved(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => setSaved(false), 2000)
  }

  const handleApiUrlChange = (value: string): void => {
    setApiUrl(value)
    showSaved()
  }

  const handleApiKeyChange = (value: string): void => {
    setApiKey(value)
    showSaved()
  }

  const handleTitleModelChange = (value: string): void => {
    setTitleModelId(value)
    showSaved()
  }

  const handleAddModel = (value: string = newModelId): void => {
    const trimmed = value.trim()
    if (!trimmed) return
    addModel(trimmed)
    setNewModelId('')
    showSaved()
  }

  const handleRemoveModel = (modelId: string): void => {
    removeModel(modelId)
    showSaved()
  }

  const importPromptFiles = async (files: FileList | File[]): Promise<void> => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    setPromptImportError(null)
    setPromptImportNotice(null)
    const promptFiles = fileArray.filter((file) => {
      const name = file.name.toLowerCase()
      return name.endsWith('.txt') || name.endsWith('.md') || file.type === 'text/plain' || file.type === 'text/markdown'
    })
    const skippedCount = fileArray.length - promptFiles.length
    if (promptFiles.length === 0) {
      setPromptImportError('請拖入 .txt 或 .md 檔案。')
      return
    }

    try {
      const processed = await processDroppedFiles(promptFiles)
      const prompts: SystemPrompt[] = processed
        .filter((attachment) => attachment.type === 'text' && attachment.content.trim())
        .map((attachment) => ({
          id: crypto.randomUUID(),
          name: attachment.name.replace(/\.(txt|md)$/i, '') || attachment.name,
          content: attachment.content.trim()
        }))
      const addedCount = addSystemPrompts(prompts)
      const duplicateCount = prompts.length - addedCount
      const skippedMessage = skippedCount > 0 ? `，略過 ${skippedCount} 個非文字檔` : ''
      const duplicateMessage = duplicateCount > 0 ? `，略過 ${duplicateCount} 筆重複或空白內容` : ''
      setPromptImportNotice(`新增 ${addedCount} 筆提示詞${skippedMessage}${duplicateMessage}`)
      if (addedCount > 0) showSaved()
    } catch (err) {
      setPromptImportError(err instanceof Error ? err.message : String(err))
    }
  }

  const handlePromptFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    void importPromptFiles(files)
  }

  const handlePromptDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setIsPromptDragging(false)
    void importPromptFiles(e.dataTransfer.files)
  }

  const handleExport = (): void => {
    const data = historyStore.exportHistory()
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `llm-arena-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportClick = (): void => {
    setImportError(null)
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as HistoryExport
        if (data.version !== 1 || !Array.isArray(data.arena) || !Array.isArray(data.debate)) {
          setImportError('這不是 LLM Arena 匯出的紀錄檔，請重新選擇。')
          return
        }
        historyStore.importHistory(data)
        setImportError(null)
        showSaved()
      } catch {
        setImportError('檔案不是有效的 JSON，請重新選擇。')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const totalArena = historyStore.arenaHistory.length
  const totalDebate = historyStore.debateHistory.length
  const totalProviders = historyStore.providerHistory.length
  const historyRows = [
    { label: '競技場', count: totalArena },
    { label: '辯論', count: totalDebate },
    { label: '供應商比較', count: totalProviders }
  ]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-5">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-xl font-semibold">設定</h2>
        <span aria-live="polite" className={`inline-flex items-center gap-1 text-xs text-ok transition-opacity duration-200 ${saved ? 'opacity-100' : 'opacity-0'}`}>
          <Icon name="check" className="h-3.5 w-3.5" />
          已自動儲存
        </span>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Section title="OpenRouter API" description="金鑰只存在這台瀏覽器，不會上傳到其他伺服器。">
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="settings-api-key" className="field-label">API Key</label>
                <div className="relative">
                  <input
                    id="settings-api-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="sk-or-..."
                    autoComplete="off"
                    className="field pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((current) => !current)}
                    aria-label={showKey ? '隱藏金鑰' : '顯示金鑰'}
                    title={showKey ? '隱藏金鑰' : '顯示金鑰'}
                    className="icon-btn absolute right-0.5 top-1/2 -translate-y-1/2"
                  >
                    <Icon name={showKey ? 'eyeOff' : 'eye'} />
                  </button>
                </div>
                <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-text underline underline-offset-2">
                  到 OpenRouter 取得金鑰
                  <Icon name="external" className="h-3 w-3" />
                </a>
              </div>

              <div className="space-y-1">
                <label htmlFor="settings-api-url" className="field-label">API URL</label>
                <input
                  id="settings-api-url"
                  type="text"
                  value={apiUrl}
                  onChange={(e) => handleApiUrlChange(e.target.value)}
                  placeholder="https://openrouter.ai/api/v1"
                  className="field font-mono"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="settings-title-model" className="field-label">話題命名模型</label>
                <input
                  id="settings-title-model"
                  type="text"
                  value={titleModelId}
                  onChange={(e) => handleTitleModelChange(e.target.value)}
                  placeholder="qwen/qwen3-vl-8b-instruct"
                  className="field font-mono"
                />
                <p className="text-xs leading-relaxed text-muted">自動替對話紀錄取標題；選支援視覺的模型，才看得懂圖片。</p>
              </div>
            </div>
          </Section>

          <Section title="對話紀錄" description="每種模式最多保留 50 筆，存在這台瀏覽器。">
            <dl className="mb-3 space-y-1">
              {historyRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-[13px]">
                  <dt className="text-muted">{row.label}</dt>
                  <dd className="num">{row.count} / 50</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExport}
                disabled={totalArena === 0 && totalDebate === 0 && totalProviders === 0}
                className="btn btn-outline flex-1"
              >
                <Icon name="download" />
                匯出 JSON
              </button>
              <button type="button" onClick={handleImportClick} className="btn btn-outline flex-1">
                <Icon name="upload" />
                匯入 JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                title="選擇要匯入的對話紀錄 JSON 檔案"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {importError && <p role="alert" className="mt-2 text-xs text-danger">{importError}</p>}
          </Section>
        </div>

        <div className="space-y-3">
          <Section
            title="常用模型"
            description="會排在模型選單最上面。也可以直接在選單裡搜尋 OpenRouter 的全部模型。"
            aside={<span className="num shrink-0 text-xs text-muted">{modelList.length} 個</span>}
          >
            <div className="mb-2 flex gap-2">
              <div className="min-w-0 flex-1">
                <ModelCombobox
                  value={newModelId}
                  ariaLabel="新增常用模型"
                  placeholder="搜尋或輸入模型 ID（如 openai/gpt-4o）"
                  onChange={setNewModelId}
                  onPick={(value) => handleAddModel(value)}
                  onEnter={() => handleAddModel()}
                />
              </div>
              <button type="button" onClick={() => handleAddModel()} disabled={!newModelId.trim()} className="btn btn-primary">
                <Icon name="plus" />
                新增
              </button>
            </div>

            {modelList.length === 0 && (
              <p className="py-3 text-center text-[13px] text-muted">還沒有常用模型，從上面的選單挑一個加入。</p>
            )}
            <ul className="grid gap-x-3 gap-y-px sm:grid-cols-2">
              {modelList.map((model) => (
                <li key={model} className="group flex items-center justify-between gap-2 rounded-lg py-0.5 pl-2.5 pr-0.5 transition-colors duration-150 hover:bg-sunken">
                  <ModelName id={model} className="text-[13px]" />
                  <button
                    type="button"
                    onClick={() => handleRemoveModel(model)}
                    aria-label={`移除 ${model}`}
                    title="移除"
                    className="icon-btn reveal hover:!text-danger"
                  >
                    <Icon name="close" />
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="系統提示詞庫"
            description="每個 .txt 或 .md 檔會變成一筆提示詞，檔名就是名稱。設定陣容時可以直接套用。"
            aside={<span className="num shrink-0 text-xs text-muted">{systemPrompts.length} 筆</span>}
          >
            <div
              role="region"
              aria-label="批量匯入系統提示詞"
              onDragOver={(e) => {
                e.preventDefault()
                setIsPromptDragging(true)
              }}
              onDragLeave={() => setIsPromptDragging(false)}
              onDrop={handlePromptDrop}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-3.5 py-3 transition-colors duration-150 ${
                isPromptDragging ? 'border-accent bg-accent/10' : 'border-line-strong'
              }`}
            >
              <p className="text-[13px] text-muted">把多個提示詞檔案拖到這裡</p>
              <button type="button" onClick={() => promptFileInputRef.current?.click()} className="btn btn-outline !h-8">
                選擇檔案
              </button>
              <input
                ref={promptFileInputRef}
                type="file"
                multiple
                accept=".txt,.md,text/plain,text/markdown"
                title="選擇要匯入的系統提示詞"
                onChange={handlePromptFileChange}
                className="hidden"
              />
            </div>

            {promptImportNotice && <p role="status" className="mt-2 text-xs text-ok">{promptImportNotice}</p>}
            {promptImportError && <p role="alert" className="mt-2 text-xs text-danger">{promptImportError}</p>}

            {systemPrompts.length > 0 && (
              <ul className="mt-2 divide-y divide-line">
                {systemPrompts.map((prompt) => (
                  <li key={prompt.id} className="group flex items-start gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{prompt.name}</p>
                      <p className="mt-0.5 line-clamp-2 break-words text-xs leading-relaxed text-muted">{prompt.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeSystemPrompt(prompt.id)
                        showSaved()
                      }}
                      aria-label={`刪除提示詞 ${prompt.name}`}
                      title="刪除提示詞"
                      className="icon-btn reveal hover:!text-danger"
                    >
                      <Icon name="close" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
