import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface MarkdownRendererProps {
  content: string
  className?: string
}

function normalizeMath(text: string): string {
  return text
    .replace(/\\\[([^]*?)\\\]/g, (_, inner) => `$$${inner}$$`)
    .replace(/\\\(([^]*?)\\\)/g, (_, inner) => `$${inner}$`)
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps): JSX.Element {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre: ({ children }) => (
            <pre className="bg-slate-100 dark:bg-slate-800/80 rounded-lg p-3 overflow-x-auto text-xs">
              {children}
            </pre>
          ),
          code: ({ children, className: codeClassName }) => {
            const isInline = !codeClassName
            if (isInline) {
              return (
                <code className="bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-xs">
                  {children}
                </code>
              )
            }
            return <code className={codeClassName}>{children}</code>
          },
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="border-collapse border border-slate-300 dark:border-slate-700">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 text-left text-xs font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs">
              {children}
            </td>
          )
        }}
      >
        {normalizeMath(content)}
      </ReactMarkdown>
    </div>
  )
}
