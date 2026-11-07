import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebateStore } from '@/stores/debate-store'
import { ModelName } from '@/components/shared/controls'
import { Icon } from '@/components/shared/icons'
import { StreamingText } from '@/components/shared/StreamingText'
import type { DebateMessage, DebateSide } from '@/types/debate'

const SIDE_STYLE = {
  for: {
    name: '正方',
    token: '正',
    text: 'text-pro',
    tokenBg: 'bg-pro/15',
    border: 'border-pro/30',
    liveBorder: 'border-pro',
    live: { '--live-color': 'var(--pro)' }
  },
  against: {
    name: '反方',
    token: '反',
    text: 'text-con',
    tokenBg: 'bg-con/15',
    border: 'border-con/30',
    liveBorder: 'border-con',
    live: { '--live-color': 'var(--con)' }
  }
} as const

export function SideToken({ side }: { side: DebateSide }): JSX.Element {
  const style = SIDE_STYLE[side]
  return <span className={`token ${style.tokenBg} ${style.text}`} aria-hidden="true">{style.token}</span>
}

function RoundPips({ total, current, isActive }: { total: number; current: number; isActive: boolean }): JSX.Element {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => {
        const round = index + 1
        const isLive = isActive && round === current
        const isDone = round < current || (!isActive && round <= current)
        return (
          <span
            key={round}
            className={`h-1.5 w-4 rounded-full ${isLive ? 'live-dot !w-4' : isDone ? 'bg-ink' : 'bg-line-strong'}`}
          />
        )
      })}
    </span>
  )
}

function getStatusText(status: string, round: number, total: number, speaker: DebateSide | null): string {
  if (status === 'judging') return '裁判評分中'
  if (status === 'debating') {
    const who = speaker ? ` · ${SIDE_STYLE[speaker].name}發言中` : ''
    return `第 ${round} / ${total} 回合${who}`
  }
  if (status === 'completed') return '辯論結束'
  return '已停止'
}

export function DebateStatusBar({ canExport, exportError, onExport }: {
  canExport: boolean
  exportError: string | null
  onExport: () => void
}): JSX.Element {
  const topic = useDebateStore((state) => state.topic)
  const status = useDebateStore((state) => state.status)
  const currentRound = useDebateStore((state) => state.currentRound)
  const totalRounds = useDebateStore((state) => state.totalRounds)
  const currentSpeaker = useDebateStore((state) => state.currentSpeaker)
  const isActive = status === 'debating' || status === 'judging'

  return (
    <div className="sticky top-0 z-10 -mx-4 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur-sm md:-mx-6 md:px-6">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={topic}>{topic || '未命名辯論'}</p>
        <div role="status" className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          <RoundPips total={totalRounds} current={status === 'judging' ? totalRounds + 1 : currentRound} isActive={status === 'debating'} />
          <span className={`truncate ${isActive && currentSpeaker && status === 'debating' ? SIDE_STYLE[currentSpeaker].text : ''}`}>
            {getStatusText(status, currentRound, totalRounds, currentSpeaker)}
          </span>
          {exportError && <span className="truncate text-danger">{exportError}</span>}
        </div>
      </div>
      {canExport && (
        <button type="button" onClick={onExport} className="btn btn-outline !h-8">
          <Icon name="download" />
          導出 PDF
        </button>
      )}
    </div>
  )
}

function SideCell({ side, modelId, text, reasoningText, isStreaming, hasError, waiting, liveRef, order }: {
  side: DebateSide
  modelId: string
  text: string
  reasoningText: string
  isStreaming: boolean
  hasError?: boolean
  waiting: boolean
  liveRef?: React.Ref<HTMLElement>
  order: string
}): JSX.Element {
  const style = SIDE_STYLE[side]
  const isEmpty = !text && !reasoningText && !isStreaming && !hasError
  return (
    <article
      ref={liveRef}
      style={style.live as React.CSSProperties}
      className={`relative min-w-0 scroll-mt-24 overflow-hidden rounded-xl border bg-panel ${order} ${
        isStreaming ? style.liveBorder : isEmpty ? 'border-dashed border-line-strong' : style.border
      }`}
    >
      {isStreaming && <div className="live-bar" />}
      <header className="flex items-center gap-2 px-3 pt-2.5">
        <SideToken side={side} />
        <span className={`shrink-0 text-[13px] font-medium ${style.text}`}>{style.name}</span>
        <ModelName id={modelId} className="flex-1 text-xs" />
      </header>
      <div className="px-3.5 pb-3 pt-1">
        {isEmpty
          ? <p className="py-2 text-[13px] text-faint">{waiting ? '等對手說完就輪到這一方' : '這回合沒有發言'}</p>
          : <StreamingText text={text} reasoningText={reasoningText} isStreaming={isStreaming} />}
      </div>
    </article>
  )
}

function findMessage(messages: DebateMessage[], round: number, side: DebateSide): DebateMessage | undefined {
  return messages.find((message) => message.round === round && message.side === side)
}

/** 使用者正在看直播才跟著捲到下一位；如果已經捲回去看前面的回合，就不打擾。 */
function useFollowSpeaker(key: string): React.RefCallback<HTMLElement> {
  const nodeRef = useRef<HTMLElement | null>(null)
  const lastKeyRef = useRef(key)
  const wasVisibleRef = useRef(true)

  useEffect(() => {
    if (lastKeyRef.current === key) return
    lastKeyRef.current = key
    if (!wasVisibleRef.current || !nodeRef.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    nodeRef.current.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
  }, [key])

  useEffect(() => {
    const timer = setInterval(() => {
      if (!nodeRef.current) return
      const rect = nodeRef.current.getBoundingClientRect()
      wasVisibleRef.current = rect.top < window.innerHeight && rect.bottom > 0
    }, 500)
    return () => clearInterval(timer)
  }, [])

  return (node) => {
    if (node) nodeRef.current = node
  }
}

export function DebateRounds(): JSX.Element {
  const store = useDebateStore()
  const [collapsedRounds, setCollapsedRounds] = useState<Set<number>>(new Set())
  const isDebating = store.status === 'debating'
  const hasLiveText = Boolean(store.currentStreamText || store.currentStreamReasoningText)
  const liveRound = store.currentSpeaker && (isDebating || hasLiveText) ? store.currentRound : null

  const rounds = useMemo(() => {
    const numbers = new Set(store.messages.map((message) => message.round))
    if (liveRound) numbers.add(liveRound)
    return [...numbers].sort((a, b) => a - b)
  }, [liveRound, store.messages])

  const followRef = useFollowSpeaker(`${store.currentRound}-${store.currentSpeaker ?? ''}`)

  const toggleRound = (round: number): void => {
    setCollapsedRounds((current) => {
      const next = new Set(current)
      if (next.has(round)) next.delete(round)
      else next.add(round)
      return next
    })
  }

  const renderCell = (round: number, side: DebateSide): JSX.Element => {
    const message = findMessage(store.messages, round, side)
    const isLive = !message && liveRound === round && store.currentSpeaker === side
    const modelId = side === 'for' ? store.forModel.modelId : store.againstModel.modelId
    const speaksSecond = store.startingSide !== side
    return (
      <SideCell
        key={side}
        side={side}
        modelId={modelId}
        text={message?.content ?? (isLive ? store.currentStreamText : '')}
        reasoningText={message?.reasoningText ?? (isLive ? store.currentStreamReasoningText : '')}
        isStreaming={isLive && isDebating}
        waiting={isDebating}
        liveRef={isLive ? followRef : undefined}
        order={speaksSecond ? 'order-2 md:order-none' : ''}
      />
    )
  }

  return (
    <div className="space-y-4">
      {rounds.map((round) => {
        const isCollapsed = collapsedRounds.has(round)
        return (
          <section key={round} aria-label={`第 ${round} 回合`} className="card-enter">
            <button
              type="button"
              onClick={() => toggleRound(round)}
              aria-expanded={!isCollapsed}
              className="mb-2 flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
            >
              <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`} />
              第 {round} 回合
            </button>
            <div hidden={isCollapsed}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {renderCell(round, 'for')}
                {renderCell(round, 'against')}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
