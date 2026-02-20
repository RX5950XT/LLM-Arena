import { useEffect, useRef, useState } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer'

const THROTTLE_MS = 120

interface StreamingTextProps {
  text: string
  isStreaming: boolean
  error?: string | null
}

/**
 * During streaming, throttle the heavy Markdown+KaTeX render to every THROTTLE_MS.
 * When streaming ends, immediately render the final text.
 */
function useThrottledContent(text: string, isStreaming: boolean): string {
  const [displayed, setDisplayed] = useState(text)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef(text)

  latestRef.current = text

  useEffect(() => {
    if (!isStreaming) {
      // Streaming ended — flush final content immediately
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setDisplayed(text)
      return
    }

    // During streaming — throttle updates
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

export function StreamingText({ text, isStreaming, error }: StreamingTextProps): JSX.Element {
  const throttled = useThrottledContent(text, isStreaming)

  if (error) {
    return (
      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
        {error}
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
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-primary-500 animate-pulse ml-0.5" />
      )}
    </div>
  )
}
