import { isValidElement, useMemo } from 'react'
import ReactMarkdown, { type Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
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

function mathMarker(tex: string, display: boolean): string {
  return `<span data-tex="${encodeURIComponent(tex.trim())}"${display ? ' data-tex-display="true"' : ''}></span>`
}

/**
 * 把公式換成只帶原始碼的標記，等模型內容過濾完才由 MathOrSpan 畫出來。
 * KaTeX 的輸出需要 class 和 style，若跟模型內容一起過濾就得放行這兩個屬性，等於讓模型能蓋住畫面。
 */
function markMath(text: string): string {
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

  // 5. Mark display math first ($$...$$)
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner: string) => mathMarker(inner, true))

  // 6. Mark inline math ($...$)
  //    Match $...$ where inner content has no newline and no unescaped $
  result = result.replace(/\$([^\n$]+?)\$/g, (_, inner: string) => mathMarker(inner, false))

  return result
}

function decodeTex(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}

type SpanProps = React.ComponentProps<'span'> & { node?: unknown; 'data-tex'?: string; 'data-tex-display'?: string }

/** 模型也能自己寫這個標記，但結果只會是一條公式，和它直接寫 $...$ 相同。KaTeX 預設 trust: false，公式裡的連結與 HTML 指令都不會生效。 */
function MathOrSpan({ node: _node, 'data-tex': encoded, 'data-tex-display': display, ...rest }: SpanProps): JSX.Element {
  const tex = encoded === undefined ? null : decodeTex(encoded)
  const html = useMemo(() => {
    if (tex === null) return null
    try {
      return katex.renderToString(tex, { displayMode: display === 'true', throwOnError: false })
    } catch (error) {
      console.warn('公式渲染失敗', error)
      return null
    }
  }, [tex, display])

  if (html !== null) return <span dangerouslySetInnerHTML={{ __html: html }} />
  return <span {...rest}>{rest.children ?? tex}</span>
}

function HiddenImage({ alt }: { alt?: string }): JSX.Element {
  return <span className="text-faint">［圖片未顯示{alt ? `：${alt}` : ''}］</span>
}

/**
 * 模型回應是不可信內容：API Key 存在 localStorage，能在這個網站執行的程式就拿得到它。
 * 以 GitHub 的白名單為底，再拿掉所有會對外發請求的圖片來源。
 */
const SANITIZE_SCHEMA = {
  ...defaultSchema,
  strip: [...(defaultSchema.strip ?? []), 'style'],
  tagNames: (defaultSchema.tagNames ?? []).filter((tag) => tag !== 'picture' && tag !== 'source'),
  attributes: {
    ...defaultSchema.attributes,
    img: [],
    span: [...(defaultSchema.attributes?.span ?? []), 'dataTex', 'dataTexDisplay']
  }
}

const BASE_COMPONENTS = {
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="table-wrap overflow-x-auto"><table>{children}</table></div>
  ),
  span: MathOrSpan,
  img: HiddenImage
}

const SCREEN_COMPONENTS = { ...BASE_COMPONENTS, pre: CodeBlock }
// 上色要排在過濾之後，否則上色用的 class 會被清掉
const SCREEN_REHYPE: Options['rehypePlugins'] = [rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA], rehypeHighlight]
const PLAIN_REHYPE: Options['rehypePlugins'] = [rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA]]

export function MarkdownRenderer({ content, className = '', plain = false }: MarkdownRendererProps): JSX.Element {
  const rendered = useMemo(() => markMath(content), [content])

  return (
    <div className={`prose ${plain ? '' : 'md'} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={plain ? PLAIN_REHYPE : SCREEN_REHYPE}
        components={plain ? BASE_COMPONENTS : SCREEN_COMPONENTS}
      >
        {rendered}
      </ReactMarkdown>
    </div>
  )
}
