import { MarkdownRenderer } from './MarkdownRenderer'

interface ReasoningDisclosureProps {
  content: string
  isStreaming?: boolean
}

export function ReasoningDisclosure({ content, isStreaming = false }: ReasoningDisclosureProps): JSX.Element | null {
  if (!content) return null

  return (
    <details className="reasoning-details mb-3 overflow-hidden rounded-lg border border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20">
      <summary className="reasoning-summary flex min-h-10 cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs font-medium text-amber-800 outline-none transition-colors hover:bg-amber-100/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 dark:text-amber-300 dark:hover:bg-amber-950/40">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 transition-transform">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
        </svg>
        <span>思考內容</span>
        <span className="ml-auto text-[11px] font-normal text-amber-600 dark:text-amber-500">
          {isStreaming ? '生成中' : `${content.length.toLocaleString('zh-TW')} 字`}
        </span>
      </summary>
      <div className="border-t border-amber-200/80 px-3 py-3 text-slate-700 dark:border-amber-900/50 dark:text-slate-300">
        <MarkdownRenderer content={content} />
      </div>
    </details>
  )
}
