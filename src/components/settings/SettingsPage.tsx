import { useState, useEffect, useRef } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { useHistoryStore } from '@/stores/history-store'
import type { HistoryExport } from '@/types/history'

export function SettingsPage(): JSX.Element {
  const {
    apiUrl, apiKey, modelList, titleModelId,
    setApiUrl, setApiKey, setTitleModelId, addModel, removeModel, loadSettings
  } = useSettingsStore()
  const historyStore = useHistoryStore()
  const [saved, setSaved] = useState(false)
  const [newModelId, setNewModelId] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="h-full p-5 overflow-y-auto">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-5">設定</h2>

      <div className="flex gap-5">
        {/* 左側：API 設定 */}
        <div className="w-80 shrink-0 space-y-5">
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
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleExport}
                disabled={totalArena === 0 && totalDebate === 0}
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
        <div className="flex-1 min-w-0">
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
        </div>
      </div>
    </div>
  )
}
