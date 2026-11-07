import { isValidElement, useMemo } from 'react'
import ReactMarkdown, { type Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { CopyButton } from './controls'
import { markMath } from './math-markers'

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
