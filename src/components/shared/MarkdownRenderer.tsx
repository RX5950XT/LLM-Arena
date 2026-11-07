import { isValidElement, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { CopyButton } from './controls'

interface MarkdownRendererProps {
  content: string
  className?: string
  /** PDF 匯出用：不加互動按鈕、程式碼上色與畫面排版，由 PDF 自己的樣式負責 */
  plain?: boolean
}

function nodeText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement<{ children?: React.ReactNode }>(node)) return nodeText(node.props.children)
  return ''
}

function CodeBlock({ children }: { children?: React.ReactNode }): JSX.Element {
  const code = Array.isArray(children) ? children[0] : children
  const className = isValidElement<{ className?: string }>(code) ? code.props.className ?? '' : ''
  const language = /language-([\w-]+)/.exec(className)?.[1]
  return (
    <div className="code-block">
      <header>
        <span>{language ?? '程式碼'}</span>
        <CopyButton text={nodeText(children).replace(/\n$/, '')} label="複製程式碼" />
      </header>
      <pre>{children}</pre>
    </div>
  )
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

const TABLE_COMPONENT = {
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="table-wrap overflow-x-auto"><table>{children}</table></div>
  )
}

const SCREEN_COMPONENTS = { ...TABLE_COMPONENT, pre: CodeBlock }
const SCREEN_REHYPE = [rehypeRaw, rehypeHighlight]
const PLAIN_REHYPE = [rehypeRaw]

export function MarkdownRenderer({ content, className = '', plain = false }: MarkdownRendererProps): JSX.Element {
  const rendered = useMemo(() => preRenderMath(content), [content])

  return (
    <div className={`prose ${plain ? '' : 'md'} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={plain ? PLAIN_REHYPE : SCREEN_REHYPE}
        components={plain ? TABLE_COMPONENT : SCREEN_COMPONENTS}
      >
        {rendered}
      </ReactMarkdown>
    </div>
  )
}
