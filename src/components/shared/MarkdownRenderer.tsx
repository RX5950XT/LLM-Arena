import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MarkdownRendererProps {
  content: string
  className?: string
}

/**
 * Strip dollar signs from inside \text{...} blocks.
 * Some models (e.g. Grok) erroneously place $ inside \text{},
 * which breaks delimiter matching.
 */
function fixTextBlocks(text: string): string {
  return text.replace(/\\text\{([^}]*)\}/g, (match, inner: string) => {
    const cleaned = inner.replace(/\$/g, '')
    return cleaned !== inner ? `\\text{${cleaned}}` : match
  })
}

/**
 * Join lines where an inline $...$ math expression was split across a line break.
 * remark-math / our regex does NOT allow newlines inside inline $...$,
 * so we merge continuation lines.
 */
function joinSplitInlineMath(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    let line = lines[i]
    i++
    while (i < lines.length) {
      const singleDollars = line.replace(/\$\$/g, '').split('$').length - 1
      if (singleDollars % 2 === 0) break
      line = line + ' ' + lines[i]
      i++
    }
    out.push(line)
  }
  return out.join('\n')
}

/**
 * Pre-render all math expressions using KaTeX directly,
 * bypassing remark-math entirely for maximum compatibility.
 */
function preRenderMath(text: string): string {
  // 1. Normalize LaTeX delimiters
  let result = text
    .replace(/\\\[([^]*?)\\\]/g, (_, inner) => `$$${inner}$$`)
    .replace(/\\\(([^]*?)\\\)/g, (_, inner) => `$${inner}$`)

  // 2. Fix LaTeX compatibility issues
  result = result
    .replace(/\{\\rm\s+([^}]+)\}/g, '\\mathrm{$1}')
    .replace(/\\rm\s+([a-zA-Z][a-zA-Z0-9./]*)/g, '\\mathrm{$1}')

  // 3. Fix dollar signs inside \text{} blocks
  result = fixTextBlocks(result)

  // 4. Join inline math split across lines
  result = joinSplitInlineMath(result)

  // 5. Render display math first ($$...$$)
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner: string) => {
    try {
      return katex.renderToString(inner.trim(), {
        displayMode: true,
        throwOnError: false
      })
    } catch {
      return `$$${inner}$$`
    }
  })

  // 6. Render inline math ($...$)
  //    Match $...$ where inner content has no newline and no unescaped $
  result = result.replace(/\$([^\n$]+?)\$/g, (_, inner: string) => {
    try {
      return katex.renderToString(inner.trim(), {
        displayMode: false,
        throwOnError: false
      })
    } catch {
      return `$${inner}$`
    }
  })

  return result
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps): JSX.Element {
  const rendered = useMemo(() => preRenderMath(content), [content])

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
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
        {rendered}
      </ReactMarkdown>
    </div>
  )
}
