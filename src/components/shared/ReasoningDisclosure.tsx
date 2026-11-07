import { Icon } from './icons'
import { MarkdownRenderer } from './MarkdownRenderer'

interface ReasoningDisclosureProps {
  content: string
  isStreaming?: boolean
}

export function ReasoningDisclosure({ content, isStreaming = false }: ReasoningDisclosureProps): JSX.Element | null {
  if (!content) return null

  return (
    <details className="reasoning-details mb-3 overflow-hidden rounded-lg bg-warn/10">
      <summary className="reasoning-summary flex min-h-9 cursor-pointer select-none items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-warn transition-colors duration-150 hover:bg-warn/10">
        <Icon name="chevronRight" className="h-3 w-3 shrink-0 transition-transform duration-150" />
        <span>思考內容</span>
        <span className="num ml-auto text-[11px] font-normal">
          {isStreaming ? '生成中' : `${content.length.toLocaleString('zh-TW')} 字`}
        </span>
      </summary>
      <div className="px-3 pb-3 pt-1 text-muted">
        <MarkdownRenderer content={content} />
      </div>
    </details>
  )
}
