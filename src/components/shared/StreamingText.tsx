import { MarkdownRenderer } from './MarkdownRenderer'

interface StreamingTextProps {
  text: string
  isStreaming: boolean
  error?: string | null
}

export function StreamingText({ text, isStreaming, error }: StreamingTextProps): JSX.Element {
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
      <MarkdownRenderer content={text} />
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-primary-500 animate-pulse ml-0.5" />
      )}
    </div>
  )
}
