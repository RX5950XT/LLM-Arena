import { fromMarkdown } from 'mdast-util-from-markdown'

interface MarkdownNode {
  type: string
  position?: { start: { offset?: number }; end: { offset?: number } }
  children?: MarkdownNode[]
}

/** 沒有這些符號就不可能有公式，大多數回應可以少解析一次 Markdown */
const MATH_HINT = /\$|\\[[(]/
/** 暫時代替 `\$`（私有區字元，正常文字不會出現），比對公式時才不會被當成分隔符 */
const ESCAPED_DOLLAR = ''
const ESCAPED_DOLLAR_PATTERN = //g
/** 公式跨行通常只跨一兩行，看太遠容易把無關的兩行接在一起 */
const MAX_LINES_AHEAD = 3

/**
 * 行內公式的 `$...$`。為了不把金額當公式，以下情況不算：
 * - 結尾的 `$` 緊接數字：`$5-$10`
 * - 只有一邊貼著空白：`$5 和 $10`、`$x and $y`（兩邊都有空白的 `$ x $` 仍算，部分模型會這樣寫）
 * - 開頭是數字且內容有中文或全形標點：`$5，方案 B 要$`
 */
const INLINE_MATH = /\$(?!\d[^\n$]*[⺀-鿿＀-￯])([^\s$](?:[^\n$]*[^\s$])?|[ \t]+[^\s$](?:[^\n$]*[^\s$])?[ \t]+)\$(?!\d)/g

function countInlineMath(text: string): number {
  return text.match(INLINE_MATH)?.length ?? 0
}

function hasOddDollars(line: string): boolean {
  return (line.replace(/\$\$/g, '').split('$').length - 1) % 2 === 1
}

function mathMarker(tex: string, display: boolean): string {
  const source = tex.trim().replace(ESCAPED_DOLLAR_PATTERN, '\\$')
  return `<span data-tex="${encodeURIComponent(source)}"${display ? ' data-tex-display="true"' : ''}></span>`
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

/** 找出跨行公式結束的那一行；接起來沒有多出一條公式就不算，金額和清單才不會被併成一行 */
function findClosingLine(lines: string[], start: number): number | null {
  let separately = countInlineMath(lines[start])
  const last = Math.min(lines.length - 1, start + MAX_LINES_AHEAD)
  for (let end = start + 1; end <= last; end++) {
    if (!lines[end].trim()) return null
    separately += countInlineMath(lines[end])
    if (hasOddDollars(lines[end])) {
      return countInlineMath(lines.slice(start, end + 1).join(' ')) > separately ? end : null
    }
  }
  return null
}

function joinSplitInlineMath(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  for (let index = 0; index < lines.length; index++) {
    const end = hasOddDollars(lines[index]) ? findClosingLine(lines, index) : null
    out.push(end === null ? lines[index] : lines.slice(index, end + 1).join(' '))
    if (end !== null) index = end
  }
  return out.join('\n')
}

function markProse(prose: string): string {
  const normalized = fixTextBlocks(
    prose
      .replace(/\\\$/g, ESCAPED_DOLLAR)
      .replace(/\{\\rm\s+([^}]+)\}/g, '\\mathrm{$1}')
      .replace(/\\rm\s+([a-zA-Z][a-zA-Z0-9./]*)/g, '\\mathrm{$1}')
  )
  const marked = joinSplitInlineMath(
    normalized
      .replace(/\\\[([^]*?)\\\]/g, (_, inner: string) => mathMarker(inner, true))
      .replace(/\\\(([^]*?)\\\)/g, (_, inner: string) => mathMarker(inner, false))
  )
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, inner: string) => mathMarker(inner, true))
    .replace(INLINE_MATH, (_, inner: string) => mathMarker(inner, false))
  return marked.replace(ESCAPED_DOLLAR_PATTERN, '\\$')
}

function collectCodeRanges(node: MarkdownNode, ranges: Array<[number, number]>): void {
  if (node.type === 'code' || node.type === 'inlineCode') {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start !== undefined && end !== undefined) ranges.push([start, end])
    return
  }
  node.children?.forEach((child) => collectCodeRanges(child, ranges))
}

/**
 * 把公式換成只帶原始碼的標記，等模型內容過濾完才由 MathOrSpan 畫出來。
 * KaTeX 的輸出需要 class 和 style，若跟模型內容一起過濾就得放行這兩個屬性，等於讓模型能蓋住畫面。
 * 程式碼的位置交給 Markdown 解析器判斷（清單或引用裡的程式碼區塊也算得準），裡面的 `$` 一律不動。
 */
export function markMath(text: string): string {
  if (!MATH_HINT.test(text)) return text

  const ranges: Array<[number, number]> = []
  collectCodeRanges(fromMarkdown(text), ranges)

  let result = ''
  let cursor = 0
  for (const [start, end] of ranges) {
    result += markProse(text.slice(cursor, start)) + text.slice(start, end)
    cursor = end
  }
  return result + markProse(text.slice(cursor))
}
