import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import katex from 'katex'
import katexCss from 'katex/dist/katex.min.css?raw'
import textLayerFontUrl from 'katex/dist/fonts/KaTeX_Caligraphic-Regular.ttf?url'
import type { DebateMessage, DebateSide, JudgeResult } from '@/types/debate'
import type { ModelConfig } from '@/types/models'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'
import { buildPdf, deflate, type PdfImage, type PdfPage, type PdfTextRun } from './pdf-writer'

export interface DebatePdfData {
  topic: string
  totalRounds: number
  startingSide: DebateSide
  forModel: ModelConfig
  againstModel: ModelConfig
  messages: DebateMessage[]
  judges: Pick<JudgeResult, 'name' | 'modelId' | 'analysis'>[]
}

interface Band {
  top: number
  bottom: number
}

interface MeasuredSection extends Band {
  xml: string
}

/** 表格跨頁時要在續頁重複的表頭 */
interface RepeatHead extends Band {
  headBottom: number
  height: number
  xml: string
}

interface PageSlice {
  start: number
  end: number
  head: RepeatHead | null
}

/** 相對於內容區左上角的 CSS px */
interface LayoutTextRun {
  text: string
  left: number
  top: number
  /** 每個 UTF-16 碼佔的寬度 */
  advances: number[]
  height: number
  fontSize: number
}

interface FontRule {
  key: string
  css: string
}

interface PdfLayout {
  sections: MeasuredSection[]
  slices: PageSlice[]
  runs: LayoutTextRun[]
  usedFontCss: string
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const PAGE_CSS_WIDTH = 794
const PAGE_CSS_HEIGHT = 1123
const PAGE_PADDING_TOP = 52
const PAGE_PADDING_SIDE = 56
const PAGE_PADDING_BOTTOM = 70
const PAGE_CONTENT_HEIGHT = PAGE_CSS_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM
const PAGE_CONTENT_WIDTH = PAGE_CSS_WIDTH - PAGE_PADDING_SIDE * 2
const PT_PER_PX = PAGE_WIDTH / PAGE_CSS_WIDTH
const RENDER_SCALE = 2
const JPEG_QUALITY = 0.92
/** 標題至少要和下一行留在同一頁 */
const KEEP_WITH_NEXT = 40
/** 比這高的表格列就不當成不可切開的整體，改成在列內的行與行之間切 */
const MAX_UNBREAKABLE_ROW = PAGE_CONTENT_HEIGHT * 0.8
/** 文字基線大約在字框由上往下 80% 的位置 */
const BASELINE_RATIO = 0.8
const SAME_LINE_TOLERANCE = 2
/** 公式縮到比這更小就看不清楚了，改成換行 */
const MIN_READABLE_MATH_SCALE = 0.65
const TABLE_BORDER_ALLOWANCE = 2
const BASE64_CHUNK = 0x8000
/** XML 不接受這些字元；帶 u 旗標時 [\uD800-\uDFFF] 只會比對到落單的代理字元 */
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF\uD800-\uDFFF]/gu
const KATEX_FONT_FACE = /@font-face\s*\{[^}]*\}/g
/** 不跟頁面的字型相依；要用的字型另外內嵌成資料，輸出成圖片時才載入得到 */
const KATEX_CSS_WITHOUT_FONTS = katexCss.replace(KATEX_FONT_FACE, '')
const KATEX_FONT_URLS = import.meta.glob<string>('/node_modules/katex/dist/fonts/*.woff2', { query: '?url', import: 'default', eager: true })

const PDF_CSS = `
${KATEX_CSS_WITHOUT_FONTS}
* { box-sizing: border-box; }
[data-pdf-flow] { display: flow-root; }
.pdf-wrapped-math { margin: 10px 0; text-align: center; }
.pdf-flow, .pdf-repeat-head { position: relative; }
.pdf-slice { overflow: hidden; }
.pdf-page {
  position: relative;
  width: ${PAGE_CSS_WIDTH}px;
  height: ${PAGE_CSS_HEIGHT}px;
  overflow: hidden;
  padding: ${PAGE_PADDING_TOP}px ${PAGE_PADDING_SIDE}px ${PAGE_PADDING_BOTTOM}px;
  background: #fff;
  color: #0f172a;
  font-family: "Microsoft JhengHei UI", "Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.55;
}
.pdf-measure-page {
  height: auto !important;
  min-height: 0 !important;
  overflow: visible !important;
}
.pdf-page h1, .pdf-page h2, .pdf-page h3 { color: #0f172a; line-height: 1.25; }
.pdf-page h1 { margin: 0 0 14px; font-size: 28px; }
.pdf-page h2 { margin: 24px 0 10px; padding-bottom: 5px; border-bottom: 1px solid #cbd5e1; font-size: 19px; }
.pdf-page h3 { margin: 18px 0 4px; font-size: 15px; }
.pdf-meta { margin: 3px 0; color: #475569; font-size: 12px; }
.pdf-block { margin: 0 0 12px; }
.pdf-block h3 { margin-top: 12px; }
.pdf-model { margin: 0 0 5px; color: #64748b; font-family: Consolas, monospace; font-size: 11px; }
.pdf-empty { color: #64748b; }
.pdf-page .prose { max-width: none; color: #1e293b; font-size: 14px; line-height: 1.6; }
.pdf-page .prose p { margin: 6px 0; }
.pdf-page .prose ul, .pdf-page .prose ol { margin: 6px 0; padding-left: 24px; }
.pdf-page .prose li { margin: 2px 0; }
.pdf-page .prose strong { color: #0f172a; }
.pdf-page .prose a { color: #166534; text-decoration: underline; }
.pdf-page .prose blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid #94a3b8; color: #475569; }
.pdf-page .prose hr { margin: 14px 0; border: 0; border-top: 1px solid #cbd5e1; }
.pdf-page .prose pre { margin: 8px 0; padding: 9px 11px; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; border-radius: 5px; background: #f1f5f9; color: #1e293b; font-family: Consolas, monospace; font-size: 11px; line-height: 1.45; }
.pdf-page .prose code { font-family: Consolas, monospace; font-size: .9em; }
.pdf-page .prose :not(pre) > code { padding: 1px 4px; border-radius: 3px; background: #f1f5f9; }
.pdf-page .overflow-x-auto { overflow: visible; }
.pdf-page .prose table { width: 100%; margin: 8px 0; border-collapse: collapse; font-size: 11px; }
.pdf-page .prose th, .pdf-page .prose td { padding: 5px 7px; border: 1px solid #94a3b8; vertical-align: top; text-align: left; overflow-wrap: anywhere; }
.pdf-page .prose th { background: #e2e8f0; font-weight: 700; }
.pdf-page .prose img { max-width: 100%; height: auto; }
.pdf-page .katex-display { margin: 10px 0; overflow: visible; text-align: center; }
.pdf-page .katex { font-size: 1.05em; }
.pdf-footer { position: absolute; right: 56px; bottom: 28px; color: #64748b; font-size: 10px; }
`

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] ?? character)
}

function renderMarkdown(content: string): string {
  return renderToStaticMarkup(React.createElement(MarkdownRenderer, {
    content: content.trim() || '（沒有回應）',
    plain: true
  }))
}

function buildSections(data: DebatePdfData): string[] {
  const sections: string[] = []
  const sideLabel = (side: DebateSide): string => side === 'for' ? '正方' : '反方'
  const addBlock = (heading: string, modelId: string, content: string): void => {
    sections.push(`<section class="pdf-block"><h3>${escapeHtml(heading)}</h3><p class="pdf-model">模型：${escapeHtml(modelId || '未設定')}</p>${renderMarkdown(content)}</section>`)
  }

  sections.push(`<header><h1>AI 辯論紀錄</h1><p class="pdf-meta">輸出時間：${escapeHtml(new Date().toLocaleString('zh-TW'))}</p><p class="pdf-meta">辯論議題：${escapeHtml(data.topic.trim() || '未填寫')}</p><p class="pdf-meta">回合數：${data.totalRounds}　起始方：${sideLabel(data.startingSide)}</p><p class="pdf-meta">正方模型：${escapeHtml(data.forModel.modelId || '未設定')}</p><p class="pdf-meta">反方模型：${escapeHtml(data.againstModel.modelId || '未設定')}</p></header>`)
  sections.push('<h2>辯論過程</h2>')
  if (data.messages.length === 0) sections.push('<p class="pdf-empty">（沒有辯論內容）</p>')
  data.messages.forEach((message) => {
    addBlock(
      `第 ${message.round} 回合 - ${sideLabel(message.side)}`,
      message.side === 'for' ? data.forModel.modelId : data.againstModel.modelId,
      message.content
    )
  })

  sections.push('<h2>裁判回應</h2>')
  if (data.judges.length === 0) sections.push('<p class="pdf-empty">（沒有裁判回應）</p>')
  data.judges.forEach((judge, index) => addBlock(`${index + 1}. ${judge.name}`, judge.modelId, judge.analysis))
  return sections
}

function isOversizedRow(row: Element): boolean {
  return row.getBoundingClientRect().height > MAX_UNBREAKABLE_ROW
}

/** 公式和表格列的文字另外處理；除此之外的文字都要算行 */
function isInsideAtom(node: Node): boolean {
  const parent = node.parentElement
  if (!parent || parent.closest('.katex')) return true
  const row = parent.closest('tr')
  return row !== null && !isOversizedRow(row)
}

/** 找出所有不能被切開的範圍：每一行文字、表格列、公式，標題則連同下一行。 */
function collectBands(flow: HTMLElement, originTop: number): Band[] {
  const doc = flow.ownerDocument
  const bands: Band[] = []
  const add = (rect: { top: number; bottom: number; width: number; height: number }, extra = 0): void => {
    if (rect.width > 0 && rect.height > 0) bands.push({ top: rect.top - originTop, bottom: rect.bottom - originTop + extra })
  }

  const walker = doc.createTreeWalker(flow, NodeFilter.SHOW_TEXT)
  const range = doc.createRange()
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (isInsideAtom(node)) continue
    range.selectNodeContents(node)
    Array.from(range.getClientRects()).forEach((rect) => add(rect))
  }
  flow.querySelectorAll('.katex-html .base, .katex-display, hr').forEach((element) => add(element.getBoundingClientRect()))
  // 表格上框線有一半畫在元素外面，範圍往上多留一點，切頁時才不會留在上一頁底部
  flow.querySelectorAll('table').forEach((table) => {
    const rect = table.getBoundingClientRect()
    bands.push({ top: rect.top - originTop - TABLE_BORDER_ALLOWANCE, bottom: rect.top - originTop + 1 })
  })
  flow.querySelectorAll('tr').forEach((row) => {
    if (!isOversizedRow(row)) add(row.getBoundingClientRect())
  })
  flow.querySelectorAll('h1, h2, h3, h4, h5, h6, .pdf-model, thead').forEach((element) => add(element.getBoundingClientRect(), KEEP_WITH_NEXT))

  const merged: Band[] = []
  for (const band of [...bands].sort((left, right) => left.top - right.top)) {
    const last = merged[merged.length - 1]
    if (last && band.top < last.bottom) last.bottom = Math.max(last.bottom, band.bottom)
    else merged.push({ ...band })
  }
  return merged
}

/** 從上往下切頁，切點一定落在兩行之間；只有單一行比整頁還高才不得不切開。續頁若還在表格裡，要扣掉重複表頭的高度。 */
function slicePages(bands: Band[], heads: RepeatHead[]): PageSlice[] {
  const slices: PageSlice[] = []
  let start = bands[0]?.top ?? 0
  for (;;) {
    const head = heads.find((candidate) => start >= candidate.headBottom - 1 && start < candidate.bottom - 1) ?? null
    const limit = start + PAGE_CONTENT_HEIGHT - (head?.height ?? 0)
    const crossing = bands.find((band) => band.top < limit && band.bottom > limit)
    const end = crossing && crossing.top > start ? crossing.top : limit
    const next = bands.find((band) => band.bottom > end)
    slices.push({ start, end, head })
    if (!next) return slices
    start = Math.max(end, next.top)
  }
}

function textRunsOf(node: Text, origin: { top: number; left: number }): LayoutTextRun[] {
  const parent = node.parentElement
  if (!parent) return []
  const doc = node.ownerDocument
  const fontSize = Number.parseFloat(doc.defaultView?.getComputedStyle(parent).fontSize ?? '') || 14
  const range = doc.createRange()
  const runs: LayoutTextRun[] = []
  let current: LayoutTextRun | null = null
  let previousLeft = 0

  for (let index = 0; index < node.data.length; index++) {
    range.setStart(node, index)
    range.setEnd(node, index + 1)
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    const top = rect.top - origin.top
    const left = rect.left - origin.left
    if (current && Math.abs(current.top - top) < SAME_LINE_TOLERANCE) {
      // 前一個字的寬度算到這個字的起點，字距和被摺疊的空白才會一起算進去
      current.advances[current.advances.length - 1] = left - previousLeft
      current.text += node.data[index]
      current.advances.push(rect.width)
    } else {
      current = { text: node.data[index], left, top, advances: [rect.width], height: rect.height, fontSize }
      runs.push(current)
    }
    previousLeft = left
  }
  return runs.filter((run) => run.text.trim())
}

function collectTextRuns(flow: HTMLElement, origin: { top: number; left: number }): LayoutTextRun[] {
  const walker = flow.ownerDocument.createTreeWalker(flow, NodeFilter.SHOW_TEXT)
  const runs: LayoutTextRun[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (!node.parentElement?.closest('.katex')) runs.push(...textRunsOf(node, origin))
  }
  // 公式的字形拼不回原文，改放 LaTeX 原始碼，搜尋和複製才有意義
  flow.querySelectorAll('.katex').forEach((element) => {
    const source = element.querySelector('annotation')?.textContent?.trim()
    const rect = element.getBoundingClientRect()
    if (!source || rect.width === 0) return
    runs.push({
      text: source,
      left: rect.left - origin.left,
      top: rect.top - origin.top,
      advances: Array.from({ length: source.length }, () => rect.width / source.length),
      height: rect.height,
      fontSize: rect.height
    })
  })
  return runs
}

/** 核取方塊是瀏覽器畫的表單元件，有些瀏覽器輸出成圖片時不會畫，改成文字符號才一致，也搜尋得到 */
function replaceCheckboxes(flow: HTMLElement): void {
  flow.querySelectorAll('input').forEach((input) => {
    const mark = flow.ownerDocument.createElement('span')
    mark.textContent = input.hasAttribute('checked') ? '☑ ' : '☐ '
    input.replaceWith(mark)
  })
}

/** 置中公式不會換行，改用行內模式重畫才能在加號、等號處換行 */
function wrapLongMath(flow: HTMLElement): void {
  flow.querySelectorAll<HTMLElement>('.katex-display').forEach((element) => {
    const source = element.querySelector('annotation')?.textContent
    // 寬出去的部分不算在元素寬度裡，要看 scrollWidth
    if (!source || PAGE_CONTENT_WIDTH / element.scrollWidth >= MIN_READABLE_MATH_SCALE) return
    const wrapped = flow.ownerDocument.createElement('div')
    wrapped.className = 'pdf-wrapped-math'
    wrapped.innerHTML = katex.renderToString(`\\displaystyle ${source}`, { displayMode: false, throwOnError: false })
    element.replaceWith(wrapped)
  })
}

/** 換行也放不下的（例如大矩陣）整個縮小，否則會超出頁面被裁掉 */
function fitOversizedMath(flow: HTMLElement): void {
  wrapLongMath(flow)
  flow.querySelectorAll<HTMLElement>('.katex-display, .pdf-wrapped-math').forEach((element) => {
    const width = element.scrollWidth
    const { height } = element.getBoundingClientRect()
    if (width === 0 || height === 0) return
    const scale = Math.min(1, PAGE_CONTENT_WIDTH / width, PAGE_CONTENT_HEIGHT / height)
    if (scale < 1) element.style.setProperty('zoom', String(scale))
  })
}

function repeatHeadOf(table: HTMLTableElement, flowRect: DOMRect, serializer: XMLSerializer): RepeatHead | null {
  const thead = table.tHead
  if (!thead) return null
  const tableRect = table.getBoundingClientRect()
  const headRect = thead.getBoundingClientRect()
  const clone = table.cloneNode(false) as HTMLTableElement
  clone.style.cssText = 'table-layout:fixed;width:100%;margin:0'
  const columns = table.ownerDocument.createElement('colgroup')
  Array.from(thead.rows[0]?.cells ?? []).forEach((cell) => {
    const column = table.ownerDocument.createElement('col')
    column.style.width = `${cell.getBoundingClientRect().width}px`
    columns.appendChild(column)
  })
  clone.append(columns, thead.cloneNode(true))
  const wrapper = table.ownerDocument.createElement('div')
  wrapper.className = 'prose pdf-repeat-head'
  wrapper.style.cssText = `margin-left:${tableRect.left - flowRect.left}px;width:${tableRect.width}px`
  wrapper.appendChild(clone)
  return {
    top: tableRect.top - flowRect.top,
    bottom: tableRect.bottom - flowRect.top,
    headBottom: headRect.bottom - flowRect.top,
    height: headRect.height,
    xml: serializer.serializeToString(wrapper).replace(INVALID_XML_CHARS, '')
  }
}

function fontKey(family: string, weight: string, style: string): string {
  const normalizedWeight = weight === 'normal' ? '400' : weight === 'bold' ? '700' : weight
  return `${family.replace(/['"]/g, '')}|${normalizedWeight}|${style}`
}

function usedFontCss(doc: Document, rules: FontRule[]): string {
  const loaded = new Set<string>()
  doc.fonts.forEach((face) => {
    if (face.status === 'loaded') loaded.add(fontKey(face.family, face.weight, face.style))
  })
  return rules.filter((rule) => loaded.has(rule.key)).map((rule) => rule.css).join('')
}

/**
 * 在隔離的 iframe 裡排版。外層頁面有 Tailwind 的樣式重設，輸出的圖片沒有，
 * 在外層量到的高度會和實際輸出不同，切點就會落在字上。
 */
async function measureSections(sections: string[], fontRules: FontRule[]): Promise<PdfLayout> {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = `position:absolute;left:-100000px;top:0;width:${PAGE_CSS_WIDTH}px;height:${PAGE_CSS_HEIGHT}px;border:0;visibility:hidden;`
  document.body.appendChild(frame)

  try {
    const doc = frame.contentDocument
    if (!doc) throw new Error('無法建立 PDF 排版區')
    const body = sections.map((section) => `<div data-pdf-flow>${section}</div>`).join('')
    const fontCss = fontRules.map((rule) => rule.css).join('')
    doc.open()
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>${PDF_CSS}${fontCss}</style></head><body style="margin:0"><div class="pdf-page pdf-measure-page"><div class="pdf-flow">${body}</div></div></body></html>`)
    doc.close()

    const flow = doc.querySelector<HTMLElement>('.pdf-flow')
    if (!flow) throw new Error('無法建立 PDF 排版區')
    // 摺疊內容在 PDF 裡沒有辦法點開，一律展開
    flow.querySelectorAll('details').forEach((element) => element.setAttribute('open', ''))
    replaceCheckboxes(flow)
    await doc.fonts.ready
    fitOversizedMath(flow)
    await doc.fonts.ready

    const flowRect = flow.getBoundingClientRect()
    const serializer = new XMLSerializer()
    const measured = Array.from(flow.querySelectorAll<HTMLElement>('[data-pdf-flow]')).map((element) => {
      const rect = element.getBoundingClientRect()
      // innerHTML 產生的是 HTML（<br>、&nbsp;），放進 SVG 要合法的 XML，否則整頁載入失敗
      return { top: rect.top - flowRect.top, bottom: rect.bottom - flowRect.top, xml: serializer.serializeToString(element).replace(INVALID_XML_CHARS, '') }
    })
    const heads = Array.from(flow.querySelectorAll('table'))
      .map((table) => repeatHeadOf(table, flowRect, serializer))
      .filter((head): head is RepeatHead => head !== null)
    return {
      sections: measured,
      slices: slicePages(collectBands(flow, flowRect.top), heads),
      runs: collectTextRuns(flow, flowRect),
      usedFontCss: usedFontCss(doc, fontRules)
    }
  } finally {
    frame.remove()
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BASE64_CHUNK))
  }
  return btoa(binary)
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`字型下載失敗 (${response.status})`)
  return new Uint8Array(await response.arrayBuffer())
}

/** 把 KaTeX 的字型轉成內嵌資料：輸出成圖片時瀏覽器不會下載外部檔案。拿不到就退回系統字型，公式仍看得懂。 */
async function loadKatexFontRules(): Promise<FontRule[]> {
  const urlByFile = new Map(Object.entries(KATEX_FONT_URLS).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]))
  const faces = katexCss.match(KATEX_FONT_FACE) ?? []
  const rules = await Promise.all(faces.map(async (face): Promise<FontRule | null> => {
    const file = /([\w-]+\.woff2)/.exec(face)?.[1]
    const family = /font-family:\s*([^;}]+)/.exec(face)?.[1]
    const url = file && urlByFile.get(file)
    if (!url || !family) return null
    const data = toBase64(await fetchBytes(url))
    const weight = /font-weight:\s*([^;}]+)/.exec(face)?.[1] ?? '400'
    const style = /font-style:\s*([^;}]+)/.exec(face)?.[1] ?? 'normal'
    return {
      key: fontKey(family.trim(), weight.trim(), style.trim()),
      css: `@font-face{font-family:${family.trim()};font-weight:${weight.trim()};font-style:${style.trim()};src:url(data:font/woff2;base64,${data}) format("woff2")}`
    }
  }))
  return rules.filter((rule): rule is FontRule => rule !== null)
}

async function tryLoad<T>(label: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load()
  } catch (error) {
    console.warn(`PDF 匯出：${label}載入失敗，改用替代方案`, error)
    return fallback
  }
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('無法將 Markdown 頁面轉成 PDF'))
    image.src = source
  })
}

/** 只放這一頁碰得到的段落，長辯論才不會每頁都帶著整份內容。 */
function sliceMarkup(sections: MeasuredSection[], { start, end, head }: PageSlice): string {
  const visible = sections.filter((section) => section.top < end && section.bottom > start)
  const shift = (visible[0]?.top ?? start) - start
  return `${head?.xml ?? ''}<div class="pdf-slice" style="height:${end - start}px"><div class="pdf-flow" style="transform:translateY(${shift}px)">${visible.map((section) => section.xml).join('')}</div></div>`
}

function sliceTextRuns(runs: LayoutTextRun[], { start, end, head }: PageSlice): PdfTextRun[] {
  const offset = PAGE_PADDING_TOP + (head?.height ?? 0)
  return runs
    .filter((run) => {
      const middle = run.top + run.height / 2
      return middle >= start && middle < end
    })
    .map((run) => ({
      text: run.text,
      x: (PAGE_PADDING_SIDE + run.left) * PT_PER_PX,
      baseline: PAGE_HEIGHT - (offset + run.top - start + run.height * BASELINE_RATIO) * PT_PER_PX,
      advances: run.advances.map((advance) => advance * PT_PER_PX),
      fontSize: run.fontSize * PT_PER_PX
    }))
}

function canvasRgb(context: CanvasRenderingContext2D, width: number, height: number): Uint8Array {
  const { data } = context.getImageData(0, 0, width, height)
  const rgb = new Uint8Array(width * height * 3)
  for (let source = 0, target = 0; source < data.length; source += 4) {
    rgb[target++] = data[source]
    rgb[target++] = data[source + 1]
    rgb[target++] = data[source + 2]
  }
  return rgb
}

/** 文字頁通常無損壓縮較小又銳利，色彩多的頁面則是 JPEG 較小，每頁各選小的。 */
async function encodeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): Promise<PdfImage> {
  const encoded = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const jpeg = decodeBase64(encoded.slice(encoded.indexOf(',') + 1))
  const flate = await deflate(canvasRgb(context, canvas.width, canvas.height))
  const size = { width: canvas.width, height: canvas.height }
  return flate && flate.length < jpeg.length
    ? { data: flate, filter: 'FlateDecode', ...size }
    : { data: jpeg, filter: 'DCTDecode', ...size }
}

async function renderPage(content: string, fontCss: string, pageNumber: number, pageCount: number): Promise<PdfImage> {
  const pageMarkup = `<div class="pdf-page">${content}<footer class="pdf-footer">LLM Arena - ${pageNumber}/${pageCount}</footer></div>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_CSS_WIDTH}" height="${PAGE_CSS_HEIGHT}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${PDF_CSS}${fontCss}</style>${pageMarkup}</div></foreignObject></svg>`
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  const image = await loadImage(svgUrl)
  const canvas = document.createElement('canvas')
  canvas.width = PAGE_CSS_WIDTH * RENDER_SCALE
  canvas.height = PAGE_CSS_HEIGHT * RENDER_SCALE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('無法建立 PDF 畫布')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return encodeCanvas(canvas, context)
}

export async function createDebatePdf(data: DebatePdfData): Promise<Blob> {
  if (typeof document === 'undefined') throw new Error('PDF 匯出需要瀏覽器環境')
  await document.fonts?.ready
  const [fontRules, textLayerFont] = await Promise.all([
    tryLoad('公式字型', loadKatexFontRules, []),
    tryLoad('文字層字型', () => fetchBytes(textLayerFontUrl), null)
  ])
  const layout = await measureSections(buildSections(data), fontRules)
  const pages: PdfPage[] = []
  // 一次一頁：頁數多時同時解碼整批圖片很吃記憶體
  for (const [index, slice] of layout.slices.entries()) {
    const markup = sliceMarkup(layout.sections, slice)
    const fontCss = markup.includes('katex') ? layout.usedFontCss : ''
    pages.push({
      image: await renderPage(markup, fontCss, index + 1, layout.slices.length),
      textRuns: sliceTextRuns(layout.runs, slice)
    })
  }
  return new Blob([await buildPdf(pages, textLayerFont)], { type: 'application/pdf' })
}

export async function downloadDebatePdf(data: DebatePdfData): Promise<void> {
  const url = URL.createObjectURL(await createDebatePdf(data))
  const link = document.createElement('a')
  link.href = url
  link.download = `llm-arena-debate-${new Date().toISOString().slice(0, 10)}.pdf`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
