import { useState, useEffect, useRef } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { useHistoryStore } from '@/stores/history-store'
import { processDroppedFiles } from '@/services/file-handler'
import type { HistoryExport } from '@/types/history'
import type { SystemPrompt } from '@/types/models'

export function SettingsPage(): JSX.Element {
  const {
    apiUrl, apiKey, modelList, systemPrompts, titleModelId,
    setApiUrl, setApiKey, setTitleModelId, addModel, removeModel,
    addSystemPrompts, removeSystemPrompt, loadSettings
  } = useSettingsStore()
  const historyStore = useHistoryStore()
  const [saved, setSaved] = useState(false)
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

  const handleAddModel = (): void => {
    const trimmed = newModelId.trim()
    if (!trimmed) return
    addModel(trimmed)
    setNewModelId('')
    showSaved()
  }

  const handleRemoveModel = (modelId: string): void => {
    removeModel(modelId)
    showSaved()
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddModel()
    }
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
          setImportError('檔案格式不正確')
          return
        }
        historyStore.importHistory(data)
        setImportError(null)
        showSaved()
      } catch {
        setImportError('無法解析 JSON 檔案')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const totalArena = historyStore.arenaHistory.length
  const totalDebate = historyStore.debateHistory.length
  const totalProviders = historyStore.providerHistory.length

  return (
    <div className="h-full p-4 md:p-5 overflow-y-auto">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-5">設定</h2>

      <div className="flex flex-col md:flex-row gap-5">
        {/* 左側：API 設定 */}
        <div className="w-full md:w-80 shrink-0 space-y-5">
          <div className="space-y-4 p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">OpenRouter API</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                API URL
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => handleApiUrlChange(e.target.value)}
                placeholder="https://openrouter.ai/api/v1"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-slate-800 dark:text-slate-200 font-mono transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="sk-or-..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-slate-800 dark:text-slate-200 font-mono transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                話題命名模型
              </label>
              <input
                type="text"
                value={titleModelId}
                onChange={(e) => handleTitleModelChange(e.target.value)}
                placeholder="qwen/qwen3-vl-8b-instruct"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-slate-800 dark:text-slate-200 font-mono transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-600">
                用於自動為對話紀錄生成標題，預設使用視覺語言模型以支援圖片辨識。
              </p>
            </div>

            <div className="pt-1 h-6 flex items-center">
              {saved && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  已自動儲存
                </span>
              )}
            </div>
          </div>

          {/* 對話紀錄管理 */}
          <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">對話紀錄</h3>
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p>競技場紀錄：{totalArena} / 50 筆</p>
              <p>辯論紀錄：{totalDebate} / 50 筆</p>
              <p>供應商比較紀錄：{totalProviders} / 50 筆</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleExport}
                disabled={totalArena === 0 && totalDebate === 0 && totalProviders === 0}
                className="flex-1 px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                匯出 JSON
              </button>
              <button
                type="button"
                onClick={handleImportClick}
                className="flex-1 px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
              >
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
            {importError && (
              <p className="text-xs text-red-500 dark:text-red-400">{importError}</p>
            )}
          </div>

          <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">使用說明</h3>
            <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5 list-decimal list-inside">
              <li>
                前往{' '}
                <span className="text-primary-600 dark:text-primary-400 font-mono">openrouter.ai</span>{' '}
                註冊帳號並取得 API Key。
              </li>
              <li>在上方輸入 API Key 並儲存。</li>
              <li>前往「模型競技場」或「AI 辯論」頁面開始使用。</li>
            </ol>
          </div>
        </div>

        {/* 右側：模型清單 */}
        <div className="flex-1 min-w-0 space-y-5">
          <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">模型清單</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              在此管理常用模型，可在競技場和辯論頁面快速選取。
            </p>

            {/* 新增模型 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="輸入模型 ID（如 openai/gpt-4o）"
                className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-slate-800 dark:text-slate-200 font-mono transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={handleAddModel}
                disabled={!newModelId.trim()}
                className="px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white disabled:text-slate-500 dark:disabled:text-slate-500 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                新增
              </button>
            </div>

            {/* 模型列表 */}
            <div className="space-y-1">
              {modelList.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-600 italic py-4 text-center">
                  尚未新增任何模型
                </p>
              )}
              {modelList.map((model) => (
                <div
                  key={model}
                  className="group flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <span className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate mr-2">
                    {model}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveModel(model)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-all cursor-pointer shrink-0"
                    title="刪除模型"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 系統提示詞 */}
          <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">系統提示詞</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  批量拖入 .txt 或 .md，每個檔案會成為一筆提示詞。
                </p>
              </div>
              <span className="shrink-0 text-xs font-mono text-slate-400 dark:text-slate-500">{systemPrompts.length} 筆</span>
            </div>

            <div
              role="region"
              aria-label="批量匯入系統提示詞"
              onDragOver={(e) => {
                e.preventDefault()
                setIsPromptDragging(true)
              }}
              onDragLeave={() => setIsPromptDragging(false)}
              onDrop={handlePromptDrop}
              className={`rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
                isPromptDragging
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">拖放多個提示詞檔案到這裡</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">檔名會作為提示詞名稱</p>
              <button
                type="button"
                onClick={() => promptFileInputRef.current?.click()}
                className="mt-3 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-700"
              >
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

            {promptImportNotice && <p className="text-xs text-emerald-600 dark:text-emerald-400">{promptImportNotice}</p>}
            {promptImportError && <p className="text-xs text-red-500 dark:text-red-400">{promptImportError}</p>}

            <div className="space-y-2">
              {systemPrompts.length === 0 && (
                <p className="py-3 text-center text-sm italic text-slate-400 dark:text-slate-600">尚未匯入系統提示詞</p>
              )}
              {systemPrompts.map((prompt) => (
                <div key={prompt.id} className="group flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{prompt.name}</p>
                    <p className="mt-1 max-h-10 overflow-hidden break-words text-xs leading-relaxed text-slate-400 dark:text-slate-500">{prompt.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      removeSystemPrompt(prompt.id)
                      showSaved()
                    }}
                    className="shrink-0 p-1 text-slate-400 transition-colors hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400"
                    title="刪除提示詞"
                    aria-label={`刪除提示詞 ${prompt.name}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
