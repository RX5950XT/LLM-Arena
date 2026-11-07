import { useState } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { Icon } from './icons'
import { ModelCombobox } from './ModelCombobox'

interface ModelSlotProps {
  label: string
  token?: React.ReactNode
  modelId: string
  placeholder?: string
  systemPrompt: string
  reasoning?: boolean
  showPromptLibrary?: boolean
  disabled?: boolean
  compact?: boolean
  onModelIdChange: (value: string) => void
  onModelPick?: (value: string) => void
  onModelEnter?: () => void
  onSystemPromptChange: (value: string) => void
  onReasoningChange?: (value: boolean) => void
  onRemove?: () => void
}

function PromptLibrary({ label, systemPrompt, disabled, onChange }: {
  label: string
  systemPrompt: string
  disabled?: boolean
  onChange: (value: string) => void
}): JSX.Element {
  const systemPrompts = useSettingsStore((state) => state.systemPrompts)
  const selectedId = systemPrompts.find((prompt) => prompt.content === systemPrompt)?.id ?? ''

  if (systemPrompts.length === 0) {
    return (
      <a href="#/settings" className="inline-block text-xs text-accent-text underline underline-offset-2">
        提示詞庫是空的，前往設定匯入
      </a>
    )
  }
  return (
    <select
      aria-label={`${label}提示詞庫`}
      value={selectedId}
      disabled={disabled}
      onChange={(event) => {
        const selected = systemPrompts.find((prompt) => prompt.id === event.target.value)
        if (selected) onChange(selected.content)
      }}
      className="field"
    >
      <option value="">手動輸入</option>
      {systemPrompts.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.name}</option>)}
    </select>
  )
}

export function ModelSlot({
  label,
  token,
  modelId,
  placeholder,
  systemPrompt,
  reasoning = false,
  showPromptLibrary = false,
  disabled,
  compact,
  onModelIdChange,
  onModelPick,
  onModelEnter,
  onSystemPromptChange,
  onReasoningChange,
  onRemove
}: ModelSlotProps): JSX.Element {
  const [showPrompt, setShowPrompt] = useState(false)
  const hasPrompt = systemPrompt.trim().length > 0
  const labelClass = compact ? 'sr-only' : 'sr-only sm:not-sr-only'

  return (
    <div className="group min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
        {token}
        <div className="min-w-0 flex-1 basis-[70%] sm:basis-auto">
          <ModelCombobox
            value={modelId}
            disabled={disabled}
            ariaLabel={`${label}的模型 ID`}
            placeholder={placeholder}
            onChange={onModelIdChange}
            onPick={onModelPick}
            onEnter={onModelEnter}
          />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowPrompt((current) => !current)}
          aria-expanded={showPrompt}
          title={hasPrompt ? '系統提示詞（已設定）' : '系統提示詞（未設定）'}
          className={`btn btn-ghost relative !px-2 ${showPrompt ? 'bg-sunken text-ink' : ''}`}
        >
          <Icon name="prompt" />
          <span className={labelClass}>提示詞</span>
          {hasPrompt && <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />}
        </button>
        {onReasoningChange && (
          <button
            type="button"
            onClick={() => onReasoningChange(!reasoning)}
            aria-pressed={reasoning}
            disabled={disabled}
            title={reasoning ? '推理模式已開啟' : '開啟推理模式'}
            className={`btn !px-2 ${reasoning ? 'bg-warn/15 text-warn hover:bg-warn/25' : 'btn-ghost'}`}
          >
            <Icon name="bulb" />
            <span className={labelClass}>推理</span>
          </button>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} disabled={disabled} aria-label={`移除${label}`} title={`移除${label}`} className="icon-btn reveal">
            <Icon name="close" />
          </button>
        )}
        </div>
      </div>

      {showPrompt && (
        <div className="card-enter mt-2 space-y-2 rounded-lg bg-sunken p-2.5">
          {showPromptLibrary && (
            <PromptLibrary label={label} systemPrompt={systemPrompt} disabled={disabled} onChange={onSystemPromptChange} />
          )}
          <textarea
            value={systemPrompt}
            disabled={disabled}
            onChange={(event) => onSystemPromptChange(event.target.value)}
            aria-label={`${label}的系統提示詞`}
            placeholder="系統提示詞（可不填）"
            rows={5}
            className="field field-area"
          />
        </div>
      )}
    </div>
  )
}
