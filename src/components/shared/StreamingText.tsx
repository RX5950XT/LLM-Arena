import { useEffect, useRef, useState } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer'

const THROTTLE_MS = 120
const DONE_FLASH_MS = 2500

interface StreamingTextProps {
  text: string
  isStreaming: boolean
  error?: string | null
}

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
    }
  }, [])

  return displayed
}

function Spinner(): JSX.Element {
  return (
    <svg className="animate-spin w-4 h-4 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

export function StreamingText({ text, isStreaming, error }: StreamingTextProps): JSX.Element {
  const throttled = useThrottledContent(text, isStreaming)
  const [showDone, setShowDone] = useState(false)
  const prevStreamingRef = useRef(isStreaming)

  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && text) {
      setShowDone(true)
      const timer = setTimeout(() => setShowDone(false), DONE_FLASH_MS)
      prevStreamingRef.current = isStreaming
      return () => clearTimeout(timer)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, text])

  if (error) {
    return (
      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (!text && isStreaming) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-2">
        <Spinner />
        <span>生成中...</span>
      </div>
    )
  }

  if (!text && !isStreaming) {
    return (
      <div className="text-sm text-slate-400 dark:text-slate-500 italic">
        等待回應...
      </div>
    )
  }

  return (
    <div>
      <MarkdownRenderer content={throttled} />
      <div className="h-5 mt-1">
        {isStreaming && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Spinner />
            生成中
          </span>
        )}
        {showDone && !isStreaming && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-500 dark:text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
            完成
          </span>
        )}
      </div>
    </div>
  )
}
