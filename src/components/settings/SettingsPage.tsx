import { useState, useEffect, useRef } from 'react'
import { useSettingsStore } from '@/stores/settings-store'

export function SettingsPage(): JSX.Element {
  const { apiUrl, apiKey, setApiUrl, setApiKey, loadSettings } = useSettingsStore()
  const [saved, setSaved] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  return (
    <div className="h-full p-5">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-5">設定</h2>

      <div className="max-w-lg space-y-5">
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
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-slate-800 dark:text-slate-200 font-mono transition-colors"
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

          <div className="pt-1 h-6 flex items-center">
            {saved && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                已自動儲存
              </span>
            )}
          </div>
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
    </div>
  )
}
