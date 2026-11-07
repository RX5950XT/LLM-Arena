export interface ArenaScore {
  slotIndex: number
  score: number
  rank: number
}

export interface DebateScore {
  pro: number
  con: number
}

const AVERAGE_HEADER = '平均總分'
const SCORE_KEYWORDS = /評分|得分|總分|平均|分數/
const NUMBER = /\d{1,3}(?:\.\d+)?/

function splitRow(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.replace(/[*`]/g, '').trim())
}

function resolveSlot(cell: string, modelIds: string[]): number {
  const letter = /(?:模型\s*)?\b([A-Za-z])\b/.exec(cell)?.[1]
  if (letter && /模型|^[A-Za-z]$/.test(cell.slice(0, cell.indexOf(letter) + 1))) {
    return letter.toUpperCase().charCodeAt(0) - 65
  }
  return modelIds.findIndex((id) => id && cell.includes(id))
}

function withRanks(scores: Omit<ArenaScore, 'rank'>[]): ArenaScore[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score)
  return sorted.map((entry) => ({
    ...entry,
    rank: sorted.findIndex((other) => other.score === entry.score) + 1
  }))
}

/** 讀裁判回覆裡的「平均總分」表格；找不到（例如自訂提示詞）就回傳空陣列，不猜分數。 */
export function parseArenaLeaderboard(markdown: string | null, modelIds: string[]): ArenaScore[] {
  if (!markdown) return []
  const lines = markdown.split('\n')
  const headerIndex = lines.findIndex((line) => line.trim().startsWith('|') && line.includes(AVERAGE_HEADER))
  if (headerIndex < 0) return []

  const scoreColumn = splitRow(lines[headerIndex]).findIndex((cell) => cell.includes(AVERAGE_HEADER))
  const seen = new Set<number>()
  const scores: Omit<ArenaScore, 'rank'>[] = []
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim().startsWith('|')) break
    const cells = splitRow(line)
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue
    const slotIndex = resolveSlot(cells[0] ?? '', modelIds)
    const score = Number(NUMBER.exec(cells[scoreColumn] ?? '')?.[0])
    if (slotIndex < 0 || slotIndex >= modelIds.length || seen.has(slotIndex) || !Number.isFinite(score)) continue
    seen.add(slotIndex)
    scores.push({ slotIndex, score })
  }
  return withRanks(scores)
}

function readSegmentNumber(segment: string): number | null {
  const equalsAt = Math.max(segment.lastIndexOf('='), segment.lastIndexOf('＝'))
  const target = equalsAt >= 0 ? segment.slice(equalsAt + 1) : segment
  const match = NUMBER.exec(target)
  if (!match) return null
  const value = Number(match[0])
  const after = target.slice(match.index + match[0].length).trimStart()
  if (value > 100 || /^[點位回個次項]/.test(after)) return null
  const gap = target.slice(0, match.index)
  const isDirect = equalsAt >= 0 || /^[\s:：|，,為是得]*$/.test(gap)
  return isDirect || after.startsWith('分') ? value : Number.NaN
}

function findSideScore(text: string, side: '正方' | '反方'): number | null {
  for (const line of text.split('\n')) {
    const hasKeyword = SCORE_KEYWORDS.test(line)
    const segments = line.split(/(?=正方|反方)/).filter((segment) => segment.startsWith(side))
    for (const segment of segments) {
      const value = readSegmentNumber(segment.slice(side.length))
      if (value === null) continue
      if (!Number.isNaN(value)) return value
      if (hasKeyword) {
        const fallback = NUMBER.exec(segment.slice(side.length))
        if (fallback) return Number(fallback[0])
      }
    }
  }
  return null
}

/** 讀裁判回覆裡的正反方分數（1–100）；讀不出雙方分數就回傳 null，畫面只顯示原文。 */
export function parseDebateScore(markdown: string): DebateScore | null {
  if (!markdown) return null
  const cleaned = markdown
    .replace(/[*`]/g, '')
    .replace(/[（(]\s*1\s*[-–~～]\s*100\s*[）)]/g, '')
    .replace(/\s*\/\s*100/g, '分')
  const finalAt = cleaned.lastIndexOf('最終總分')
  const scope = finalAt >= 0 ? cleaned.slice(finalAt) : cleaned
  const pro = findSideScore(scope, '正方')
  const con = findSideScore(scope, '反方')
  return pro === null || con === null ? null : { pro, con }
}
