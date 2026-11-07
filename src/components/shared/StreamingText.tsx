import { useEffect, useRef, useState } from 'react'
import { CopyButton } from './controls'
import { Icon } from './icons'
import { LazyMarkdown } from './LazyMarkdown'
import { ReasoningDisclosure } from './ReasoningDisclosure'

const THROTTLE_MS = 120
const CLOCK_TICK_MS = 100

interface StreamingTextProps {
  text: string
  reasoningText?: string
  isStreaming: boolean
  error?: string | null
}

interface StreamTiming {
  startedAt: number | null
  firstOutputAt: number | null
  finishedAt: number | null
}

const NO_TIMING: StreamTiming = { startedAt: null, firstOutputAt: null, finishedAt: null }

function useThrottledContent(text: string, isStreaming: boolean): string {
  const [displayed, setDisplayed] = useState(text)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef(text)

  latestRef.current = text

  useEffect(() => {
    if (!isStreaming) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setDisplayed(text)
      return
    }

    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        setDisplayed(latestRef.current)
        timerRef.current = null
      }, THROTTLE_MS)
    }
  }, [text, isStreaming])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      // 要歸零：StrictMode 會重跑 effect，留著舊值就不會再排下一次更新，文字會卡到串流結束
      timerRef.current = null
    }
  }, [])

  return displayed
}

/** 只量畫面親眼看到的那次生成；中途切回來的回答沒有完整起點，就不顯示時間，避免數字騙人。 */
function useStreamTiming(isStreaming: boolean, hasOutput: boolean): StreamTiming {
  const [timing, setTiming] = useState<StreamTiming>(NO_TIMING)
  const joinedLateRef = useRef(isStreaming && hasOutput)

  useEffect(() => {
    if (isStreaming) {
      if (joinedLateRef.current) return
      setTiming((current) => current.startedAt && !current.finishedAt
        ? current
        : { startedAt: Date.now(), firstOutputAt: null, finishedAt: null })
      return
    }
    joinedLateRef.current = false
    setTiming((current) => current.startedAt && !current.finishedAt ? { ...current, finishedAt: Date.now() } : current)
  }, [isStreaming])

  useEffect(() => {
    if (!isStreaming || !hasOutput) return
    setTiming((current) => current.startedAt && !current.firstOutputAt ? { ...current, firstOutputAt: Date.now() } : current)
  }, [hasOutput, isStreaming])

  return timing
}

const STATUS_ADVICE: Record<string, string> = {
  '400': '這個模型不接受這次的請求內容，可能是不支援圖片或推理模式。',
  '401': 'API Key 無效，請到設定頁檢查。',
  '402': 'OpenRouter 額度不足，請先儲值再重新發送。',
  '403': '這把金鑰沒有使用這個模型的權限。',
  '404': '找不到這個模型，請確認模型 ID。',
  '408': '模型回應逾時，請重新發送。',
  '429': '請求太頻繁或額度已達上限，稍等一下再試。',
  '502': '模型供應商暫時出問題，稍後再試或換一個模型。',
  '503': '目前沒有可用的供應商，稍後再試或換一個模型。'
}

/** 把「API 錯誤 (402): {json}」轉成看得懂、知道下一步的句子；認不得的狀態碼就保留原文。 */
function toFriendlyError(error: string): string {
  const match = /API 錯誤 \((\d+)\)/.exec(error)
  return (match && STATUS_ADVICE[match[1]]) || error
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

function LiveClock({ startedAt }: { startedAt: number }): JSX.Element {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [])
  return <span className="num">{formatSeconds(Math.max(0, now - startedAt))}</span>
}

function getRate(timing: StreamTiming, length: number): string | null {
  if (!timing.firstOutputAt || !timing.finishedAt || length === 0) return null
  const seconds = (timing.finishedAt - timing.firstOutputAt) / 1000
  return seconds > 0.2 ? `${Math.round(length / seconds).toLocaleString('zh-TW')} 字/秒` : null
}

function StatusLine({ timing, isStreaming, hasText, hasFailed, length }: {
  timing: StreamTiming
  isStreaming: boolean
  hasText: boolean
  hasFailed: boolean
  length: number
}): JSX.Element {
  if (isStreaming) {
    return (
      <>
        <span className="live-dot" />
        <span>{hasText ? '生成中' : '等待回應'}</span>
        {timing.startedAt && <LiveClock startedAt={timing.startedAt} />}
      </>
    )
  }
  if (hasFailed) {
    return (
      <>
        <span className="font-medium text-danger">失敗</span>
        {length > 0 && <span className="num">已收到 {length.toLocaleString('zh-TW')} 字</span>}
      </>
    )
  }
  const rate = getRate(timing, length)
  return (
    <>
      {timing.finishedAt && <Icon name="check" className="h-3.5 w-3.5 text-ok" />}
      {timing.startedAt && timing.finishedAt && <span className="num text-ink">{formatSeconds(timing.finishedAt - timing.startedAt)}</span>}
      {timing.startedAt && timing.firstOutputAt && <span className="num">首字 {formatSeconds(timing.firstOutputAt - timing.startedAt)}</span>}
      {rate && <span className="num">{rate}</span>}
      {length > 0 && <span className="num">{length.toLocaleString('zh-TW')} 字</span>}
    </>
  )
}

function WaitingLines(): JSX.Element {
  return (
    <div className="space-y-2.5 py-1" aria-hidden="true">
      <div className="skeleton h-3 w-11/12" />
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-2/3" />
    </div>
  )
}

export function StreamingText({ text, reasoningText = '', isStreaming, error }: StreamingTextProps): JSX.Element {
  const throttled = useThrottledContent(text, isStreaming)
  const hasOutput = Boolean(text || reasoningText)
  const timing = useStreamTiming(isStreaming, hasOutput)

  return (
    <div>
      <div className="mb-2 flex min-h-7 items-center gap-x-2.5 gap-y-0.5 text-xs text-muted">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-0.5" role="status">
          <StatusLine timing={timing} isStreaming={isStreaming} hasText={hasOutput} hasFailed={Boolean(error)} length={text.length} />
        </div>
        {text && !isStreaming && <CopyButton text={text} label="複製回答" />}
      </div>

      <ReasoningDisclosure content={reasoningText} isStreaming={isStreaming} />
      {error && (
        <div role="alert" className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-[13px] leading-relaxed text-danger">{toFriendlyError(error)}</div>
      )}
      {text && <LazyMarkdown content={throttled} />}
      {!hasOutput && isStreaming && <WaitingLines />}
      {!hasOutput && !isStreaming && !error && <p className="text-[13px] text-faint">沒有回應</p>}
    </div>
  )
}
