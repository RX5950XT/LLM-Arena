import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import katexCss from 'katex/dist/katex.min.css?raw'
import type { DebateMessage, DebateSide, JudgeResult } from '@/types/debate'
import type { ModelConfig } from '@/types/models'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'

export interface DebatePdfData {
  topic: string
  totalRounds: number
  startingSide: DebateSide
  forModel: ModelConfig
  againstModel: ModelConfig
  messages: DebateMessage[]
  judges: Pick<JudgeResult, 'name' | 'modelId' | 'analysis'>[]
}

interface PdfImage {
  data: Uint8Array
  width: number
  height: number
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const PAGE_CSS_WIDTH = 794
const PAGE_CSS_HEIGHT = 1123
const PAGE_CONTENT_HEIGHT = 1000
const RENDER_SCALE = 2

const PDF_CSS = `
${katexCss}
* { box-sizing: border-box; }
.pdf-page {
  position: relative;
  width: ${PAGE_CSS_WIDTH}px;
  height: ${PAGE_CSS_HEIGHT}px;
  overflow: hidden;
  padding: 52px 56px 70px;
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
    content: content.trim() || '（沒有回應）'
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

function paginateSections(sections: string[]): string[][] {
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:-100000px;top:0;width:794px;visibility:hidden;'
  host.innerHTML = `<style>${PDF_CSS}</style><div class="pdf-page pdf-measure-page">${sections.map((section, index) => `<div data-pdf-flow="${index}">${section}</div>`).join('')}</div>`
  document.body.appendChild(host)

  try {
    const items = Array.from(host.querySelectorAll<HTMLElement>('[data-pdf-flow]'))
    const pages: string[][] = []
    let page: string[] = []
    let height = 0
    for (const item of items) {
      const itemHeight = item.getBoundingClientRect().height
      if (page.length > 0 && height + itemHeight > PAGE_CONTENT_HEIGHT) {
        pages.push(page)
        page = []
        height = 0
      }
      page.push(item.innerHTML)
      height += itemHeight
    }
    if (page.length > 0) pages.push(page)
    return pages.length > 0 ? pages : [['<p class="pdf-empty">（沒有內容）</p>']]
  } finally {
    host.remove()
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

async function renderPage(content: string, pageNumber: number, pageCount: number): Promise<PdfImage> {
  const pageMarkup = `<div class="pdf-page">${content}<footer class="pdf-footer">LLM Arena - ${pageNumber}/${pageCount}</footer></div>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_CSS_WIDTH}" height="${PAGE_CSS_HEIGHT}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${PDF_CSS}</style>${pageMarkup}</div></foreignObject></svg>`
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
    const encoded = canvas.toDataURL('image/jpeg', 0.92)
    return {
      data: decodeBase64(encoded.slice(encoded.indexOf(',') + 1)),
      width: canvas.width,
      height: canvas.height
    }
}

function ascii(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function serializePdf(pages: PdfImage[]): Uint8Array {
  const pageRefs = pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ')
  const objects: Array<string | Uint8Array> = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`
  ]

  pages.forEach((page, index) => {
    const pageNumber = 3 + index * 3
    const contentNumber = pageNumber + 1
    const imageNumber = pageNumber + 2
    const content = `q\n${PAGE_WIDTH} 0 0 ${PAGE_HEIGHT} 0 0 cm\n/Im1 Do\nQ`
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im1 ${imageNumber} 0 R >> >> /Contents ${contentNumber} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      concatBytes([
        ascii(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.data.length} >>\nstream\n`),
        page.data,
        ascii('\nendstream')
      ])
    )
  })

  const chunks: Uint8Array[] = [ascii('%PDF-1.4\n')]
  const offsets = [0]
  let length = chunks[0].length
  const append = (part: string | Uint8Array): void => {
    const bytes = typeof part === 'string' ? ascii(part) : part
    chunks.push(bytes)
    length += bytes.length
  }

  objects.forEach((object, index) => {
    offsets.push(length)
    append(`${index + 1} 0 obj\n`)
    append(object)
    append('\nendobj\n')
  })

  const xrefOffset = length
  append(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`)
  append(offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n'))
  append(`\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)
  return concatBytes(chunks)
}

export async function createDebatePdf(data: DebatePdfData): Promise<Blob> {
  if (typeof document === 'undefined') throw new Error('PDF 匯出需要瀏覽器環境')
  await document.fonts?.ready
  const pages = paginateSections(buildSections(data))
  const images = await Promise.all(pages.map((page, index) => renderPage(page.join(''), index + 1, pages.length)))
  return new Blob([serializePdf(images)], { type: 'application/pdf' })
}

export async function downloadDebatePdf(data: DebatePdfData): Promise<void> {
  const url = URL.createObjectURL(await createDebatePdf(data))
  const link = document.createElement('a')
  link.href = url
  link.download = `llm-arena-debate-${new Date().toISOString().slice(0, 10)}.pdf`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
