/** 把整頁圖片組成 PDF；圖片上疊一層看不見的文字，讓內容可以搜尋、選取和複製。 */

export interface PdfImage {
  data: Uint8Array
  width: number
  height: number
  filter: 'DCTDecode' | 'FlateDecode'
}

/** 座標與大小都是 PDF 單位（pt），y 從頁面底部算起；advances 是每個 UTF-16 碼在圖片上佔的寬度 */
export interface PdfTextRun {
  text: string
  x: number
  baseline: number
  advances: number[]
  fontSize: number
}

export interface PdfPage {
  image: PdfImage
  textRuns: PdfTextRun[]
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const CMAP_BLOCK_SIZE = 100
const PDF_NUMBER_DIGITS = 2
/** 文字層字型（KaTeX Caligraphic）裡字母 D 的字形編號，它的大小接近一般文字 */
const TEXT_LAYER_GLYPH_ID = 7
const CID_COUNT = 0x10000
/** 寬度為 0 的縮放在部分閱讀器有問題 */
const MIN_HORIZONTAL_SCALE = 1

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

/** 瀏覽器不支援時回傳 null，呼叫端改用不壓縮或 JPEG */
export async function deflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function streamObject(dictionary: string, data: Uint8Array): Uint8Array {
  return concatBytes([ascii(`<< ${dictionary} /Length ${data.length} >>\nstream\n`), data, ascii('\nendstream')])
}

async function compressedStreamObject(dictionary: string, data: Uint8Array): Promise<Uint8Array> {
  const compressed = await deflate(data)
  return compressed
    ? streamObject(`${dictionary} /Filter /FlateDecode`, compressed)
    : streamObject(dictionary, data)
}

function number(value: number): string {
  return value.toFixed(PDF_NUMBER_DIGITS)
}

function isEncodable(code: number): boolean {
  return code >= 0x20 && (code < 0xd800 || code > 0xdfff)
}

function codeHex(code: number): string {
  return code.toString(16).padStart(4, '0')
}

/** 英數字一組、其他文字一組，換組就是新的一段 */
function isLatin(code: number): boolean {
  return code < 0x2e80
}

/**
 * 每個英文單字、每串中文各自一段，段內共用一個水平縮放（Tz），讓整段寬度等於它在圖片上的寬度。
 * 段與段之間沒有縫，閱讀器不會誤加空格，中英混排的搜尋框也對得上。
 * 不要拆到每個字一段：PDFium（Chrome 的 PDF 閱讀器）遇到那種寫法會把文字整段丟掉。
 */
function positionedText(run: PdfTextRun): string {
  const parts: string[] = []
  let hex = ''
  let count = 0
  let width = 0
  const flush = (): void => {
    if (count > 0) {
      const scale = Math.max(MIN_HORIZONTAL_SCALE, (width / (count * run.fontSize)) * 100)
      parts.push(`${scale.toFixed(2)} Tz <${hex}> Tj`)
    }
    hex = ''
    count = 0
    width = 0
  }

  for (let index = 0; index < run.text.length; index++) {
    const code = run.text.charCodeAt(index)
    const advance = run.advances[index] ?? 0
    // 表情符號沒有字碼可用，寬度併進目前這段，後面的字才不會往前跑
    if (!isEncodable(code)) {
      width += advance
      continue
    }
    const previous = index > 0 ? run.text.charCodeAt(index - 1) : code
    const afterSpace = previous === 0x20 && code !== 0x20
    if (afterSpace || isLatin(previous) !== isLatin(code)) flush()
    hex += codeHex(code)
    count++
    width += advance
  }
  flush()
  return parts.join(' ')
}

function textOperators(runs: PdfTextRun[]): string {
  return runs.map((run) => {
    if (run.fontSize <= 0) return ''
    const content = positionedText(run)
    if (!content) return ''
    return `BT /F1 ${number(run.fontSize)} Tf 3 Tr 1 0 0 1 ${number(run.x)} ${number(run.baseline)} Tm ${content} ET`
  }).filter(Boolean).join('\n')
}

/** 字碼對應回同一個 Unicode 值；代理字元區不會用到，跳過 */
function toUnicodeCMap(): string {
  const ranges: string[] = []
  for (let high = 0; high < 0x100; high++) {
    if (high >= 0xd8 && high <= 0xdf) continue
    const prefix = high.toString(16).padStart(2, '0')
    ranges.push(`<${prefix}00> <${prefix}ff> <${prefix}00>`)
  }
  const blocks: string[] = []
  for (let index = 0; index < ranges.length; index += CMAP_BLOCK_SIZE) {
    const block = ranges.slice(index, index + CMAP_BLOCK_SIZE)
    blocks.push(`${block.length} beginbfrange\n${block.join('\n')}\nendbfrange`)
  }
  return `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <ffff>
endcodespacerange
${blocks.join('\n')}
endcmap
CMapName currentdict /CMap defineresource pop
end
end`
}

function allCidsToOneGlyph(): Uint8Array {
  const map = new Uint8Array(CID_COUNT * 2)
  for (let index = 0; index < map.length; index += 2) {
    map[index] = TEXT_LAYER_GLYPH_ID >> 8
    map[index + 1] = TEXT_LAYER_GLYPH_ID & 0xff
  }
  return map
}

/**
 * 文字模式 3 不會畫出任何筆畫，字型內容其實用不到，但閱讀器要求字型存在才肯處理文字。
 * 所以嵌入一個很小的字型充數，字元對應全靠 ToUnicode，做法和 OCR 工具的隱形文字層相同。
 * 所有字碼都要對到同一個有形狀且大小正常的字形：PDFium 靠字形外框判斷文字是否重複繪製，
 * 空白或過大的字形會讓同一欄的相同文字被當成重複而丟掉。
 */
async function fontObjects(firstNumber: number, fontFile: Uint8Array): Promise<Array<string | Uint8Array>> {
  const descendant = firstNumber + 1
  const descriptor = firstNumber + 2
  const file = firstNumber + 3
  const toUnicode = firstNumber + 4
  const cidToGid = firstNumber + 5
  return [
    `<< /Type /Font /Subtype /Type0 /BaseFont /LLMArenaTextLayer /Encoding /Identity-H /DescendantFonts [${descendant} 0 R] /ToUnicode ${toUnicode} 0 R >>`,
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /LLMArenaTextLayer /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /CIDToGIDMap ${cidToGid} 0 R /DW 1000 >>`,
    `<< /Type /FontDescriptor /FontName /LLMArenaTextLayer /Flags 4 /FontBBox [0 -200 1000 800] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 /FontFile2 ${file} 0 R >>`,
    await compressedStreamObject(`/Length1 ${fontFile.length}`, fontFile),
    await compressedStreamObject('', ascii(toUnicodeCMap())),
    await compressedStreamObject('', allCidsToOneGlyph())
  ]
}

async function pageObjects(page: PdfPage, pageNumber: number, fontNumber: number | null): Promise<Array<string | Uint8Array>> {
  const contentNumber = pageNumber + 1
  const imageNumber = pageNumber + 2
  const text = fontNumber === null ? '' : textOperators(page.textRuns)
  const content = `q\n${PAGE_WIDTH} 0 0 ${PAGE_HEIGHT} 0 0 cm\n/Im1 Do\nQ\n${text}`
  const fonts = fontNumber === null ? '' : `/Font << /F1 ${fontNumber} 0 R >>`
  const { image } = page
  return [
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /ProcSet [/PDF /Text /ImageC] /XObject << /Im1 ${imageNumber} 0 R >> ${fonts} >> /Contents ${contentNumber} 0 R >>`,
    await compressedStreamObject('', ascii(content)),
    streamObject(`/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${image.filter}`, image.data)
  ]
}

function assemble(objects: Array<string | Uint8Array>): Uint8Array {
  const chunks: Uint8Array[] = [ascii('%PDF-1.5\n')]
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

/** 物件編號：1 目錄、2 頁面樹、每頁 3 個物件，文字層字型排在最後。字型拿不到時就只輸出圖片。 */
export async function buildPdf(pages: PdfPage[], textLayerFont: Uint8Array | null): Promise<Uint8Array> {
  const pageNumbers = pages.map((_, index) => 3 + index * 3)
  const fontNumber = textLayerFont ? 3 + pages.length * 3 : null
  const objects: Array<string | Uint8Array> = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`
  ]
  for (const [index, page] of pages.entries()) {
    objects.push(...await pageObjects(page, pageNumbers[index], fontNumber))
  }
  if (textLayerFont && fontNumber !== null) objects.push(...await fontObjects(fontNumber, textLayerFont))
  return assemble(objects)
}
