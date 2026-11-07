import { useState } from 'react'
import { ModelName } from './controls'
import { Icon, Spinner } from './icons'
import { StreamingText } from './StreamingText'

export type ResponseLayout = 'columns' | 'stack'

export interface ResponseAttempt {
  responseText: string
  reasoningText?: string
  isStreaming: boolean
  error: string | null
}

interface ResponseCardProps {
  token?: string
  modelId?: string
  title?: string
  caption?: string
  attempts: ResponseAttempt[]
  rank?: number
  score?: number
  layout: ResponseLayout
  isCollapsed: boolean
  onToggleCollapse: () => void
}

function RankBadge({ rank, score }: { rank: number; score?: number }): JSX.Element {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium ${
      rank === 1 ? 'bg-accent text-accent-ink' : 'bg-sunken text-muted'
    }`}>
      第 {rank} 名
      {score !== undefined && <span className="num">{score.toFixed(2)}</span>}
    </span>
  )
}

function AttemptTabs({ attempts, active, onSelect }: {
  attempts: ResponseAttempt[]
  active: number
  onSelect: (index: number) => void
}): JSX.Element {
  return (
    <div role="tablist" aria-label="重複回答" className="flex gap-0.5 overflow-x-auto border-b border-line px-2">
      {attempts.map((attempt, index) => (
        <button
          key={index}
          type="button"
          role="tab"
          aria-selected={index === active}
          onClick={() => onSelect(index)}
          className={`-mb-px flex h-8 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-2 text-xs transition-colors duration-150 ${
            index === active ? 'border-accent font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          第 {index + 1} 次
          {attempt.isStreaming && <span className="live-dot" />}
          {attempt.error && <span className="h-1.5 w-1.5 rounded-full bg-danger" title="這次回答失敗" />}
        </button>
      ))}
    </div>
  )
}

export function ResponseCard({
  token,
  modelId,
  title,
  caption,
  attempts,
  rank,
  score,
  layout,
  isCollapsed,
  onToggleCollapse
}: ResponseCardProps): JSX.Element {
  const [activeAttempt, setActiveAttempt] = useState(0)
  const isStreaming = attempts.some((attempt) => attempt.isStreaming)
  const safeActive = Math.min(activeAttempt, Math.max(attempts.length - 1, 0))
  const isWinner = rank === 1

  return (
    <article className={`card-enter relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-panel transition-colors duration-200 ${
      isWinner ? 'border-accent/70' : isStreaming ? 'border-line-strong' : 'border-line'
    }`}>
      {isStreaming && <div className="live-bar" />}
      <header className="flex min-h-11 items-center gap-2 px-3 py-2">
        {token && <span className="token">{token}</span>}
        <span className="min-w-0 flex-1">
          {title && <span className="block truncate text-[13px] font-medium">{title}</span>}
          {modelId && <ModelName id={modelId} className="text-[13px]" />}
          {caption && <span className="block truncate font-mono text-[11px] text-faint">{caption}</span>}
        </span>
        {rank !== undefined && <RankBadge rank={rank} score={score} />}
        {isCollapsed && isStreaming && <Spinner />}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? '展開回答' : '收合回答'}
          title={isCollapsed ? '展開' : '收合'}
          className="icon-btn !h-7 !w-7"
        >
          <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-180'}`} />
        </button>
      </header>

      {/* 收合時內容仍要掛著，背景計時和串流才不會中斷 */}
      <div hidden={isCollapsed}>
        {attempts.length > 1 && <AttemptTabs attempts={attempts} active={safeActive} onSelect={setActiveAttempt} />}
        <div className={`px-3.5 pb-3.5 pt-1.5 ${layout === 'columns' ? 'min-h-40 max-h-[min(70vh,44rem)] overflow-y-auto' : ''}`}>
          {attempts.map((attempt, index) => (
            <div key={index} hidden={index !== safeActive}>
              <StreamingText
                text={attempt.responseText}
                reasoningText={attempt.reasoningText}
                isStreaming={attempt.isStreaming}
                error={attempt.error}
              />
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

const LAYOUT_KEY = 'llm-arena-response-layout'

function readLayout(): ResponseLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'stack' ? 'stack' : 'columns'
  } catch {
    return 'columns'
  }
}

export function useResponseLayout(): [ResponseLayout, (layout: ResponseLayout) => void] {
  const [layout, setLayoutState] = useState<ResponseLayout>(readLayout)
  const setLayout = (next: ResponseLayout): void => {
    setLayoutState(next)
    try {
      localStorage.setItem(LAYOUT_KEY, next)
    } catch (error) {
      console.warn('版面偏好儲存失敗', error)
    }
  }
  return [layout, setLayout]
}

export function responseGridClass(layout: ResponseLayout): string {
  return layout === 'stack'
    ? 'grid grid-cols-1 gap-3'
    : 'grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]'
}
