import { useState } from 'react'

interface ModelSlotProps {
  label: string
  modelId: string
  systemPrompt: string
  reasoning?: boolean
  onModelIdChange: (value: string) => void
  onSystemPromptChange: (value: string) => void
  onReasoningChange?: (value: boolean) => void
}

export function ModelSlot({
  label,
  modelId,
  systemPrompt,
  reasoning = false,
  onModelIdChange,
  onSystemPromptChange,
  onReasoningChange
}: ModelSlotProps): JSX.Element {
  const [showPrompt, setShowPrompt] = useState(false)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
          {label}
        </span>
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="text-xs text-slate-400 hover:text-primary-500 dark:text-slate-500 dark:hover:text-primary-400 transition-colors cursor-pointer"
        >
          {showPrompt ? '隱藏提示詞' : '系統提示詞'}
        </button>
        {onReasoningChange && (
          <button
            onClick={() => onReasoningChange(!reasoning)}
            className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md transition-colors cursor-pointer border ${
              reasoning
                ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
            }`}
            title={reasoning ? '推理模式已啟用' : '啟用推理模式'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
            <span>推理</span>
          </button>
        )}
      </div>
      <input
        type="text"
        value={modelId}
        onChange={(e) => onModelIdChange(e.target.value)}
        placeholder="模型 ID（如 google/gemini-2.5-pro）"
        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono"
      />
      {showPrompt && (
        <textarea
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          placeholder="系統提示詞（可選）"
          rows={5}
          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-y text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
        />
      )}
    </div>
  )
}
