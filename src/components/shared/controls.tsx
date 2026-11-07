import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { Icon } from './icons'

interface SegmentOption<T extends string> {
  value: T
  label: React.ReactNode
  title?: string
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: SegmentOption<T>[]
  disabled?: boolean
  onChange: (value: T) => void
}

export function Segmented<T extends string>({ label, value, options, disabled, onChange }: SegmentedProps<T>): JSX.Element {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-lg bg-sunken p-0.5">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.title}
            title={option.title}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed ${
              selected ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface RangeFieldProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  unit: string
  disabled?: boolean
  className?: string
  onChange: (value: number) => void
}

export function RangeField({ id, label, value, min, max, unit, disabled, className = '', onChange }: RangeFieldProps): JSX.Element {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <label htmlFor={id} className="field-label shrink-0">{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
        className="range min-w-16 flex-1"
      />
      <output htmlFor={id} className="num shrink-0 text-right text-[13px] text-ink">{value} {unit}</output>
    </div>
  )
}

export function CopyButton({ text, label = '複製' }: { text: string; label?: string }): JSX.Element {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setState('done')
    } catch (error) {
      console.error('複製失敗', error)
      setState('failed')
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setState('idle'), 1600)
  }

  const title = state === 'done' ? '已複製' : state === 'failed' ? '複製失敗，瀏覽器沒有允許' : label
  return (
    <button type="button" onClick={() => void handleCopy()} title={title} aria-label={title} className="icon-btn !h-7 !w-7">
      <Icon name={state === 'done' ? 'check' : 'copy'} className={`h-3.5 w-3.5 ${state === 'done' ? 'text-ok' : state === 'failed' ? 'text-danger' : ''}`} />
    </button>
  )
}

export function ApiKeyBanner(): JSX.Element | null {
  const isLoaded = useSettingsStore((state) => state.isLoaded)
  const apiKey = useSettingsStore((state) => state.apiKey)
  const setApiKey = useSettingsStore((state) => state.setApiKey)
  const [draft, setDraft] = useState('')

  if (!isLoaded || apiKey) return null

  const save = (event: React.FormEvent): void => {
    event.preventDefault()
    if (draft.trim()) setApiKey(draft.trim())
  }

  return (
    <form onSubmit={save} className="panel flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">貼上 OpenRouter API Key 就能開始</p>
        <p className="mt-0.5 text-xs text-muted">
          金鑰只存在這台瀏覽器。還沒有的話，
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-accent-text underline underline-offset-2">到 OpenRouter 建立一把</a>。
        </p>
      </div>
      <div className="flex gap-2 sm:w-96">
        <input
          type="password"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="sk-or-..."
          aria-label="OpenRouter API Key"
          autoComplete="off"
          className="field font-mono"
        />
        <button type="submit" disabled={!draft.trim()} className="btn btn-primary">儲存</button>
      </div>
    </form>
  )
}

export function RecoveryBanner({ message, onDismiss }: { message: string; onDismiss: () => void }): JSX.Element {
  return (
    <div role="status" className="flex items-center gap-2.5 rounded-xl border border-warn/40 bg-warn/10 py-1.5 pl-3 pr-1.5 text-[13px]">
      <Icon name="warning" className="h-4 w-4 shrink-0 text-warn" />
      <span className="min-w-0 flex-1">{message}</span>
      <button type="button" onClick={onDismiss} aria-label="關閉提示" className="icon-btn"><Icon name="close" /></button>
    </div>
  )
}

/** 讓模型 ID 的「供應商/」變淡，視線先落在模型名稱。 */
export function ModelName({ id, className = '' }: { id: string; className?: string }): JSX.Element {
  const slashAt = id.indexOf('/')
  return (
    <span title={id} className={`block min-w-0 truncate font-mono ${className}`}>
      {slashAt > 0 && <span className="text-faint">{id.slice(0, slashAt + 1)}</span>}
      {slashAt > 0 ? id.slice(slashAt + 1) : id}
    </span>
  )
}
