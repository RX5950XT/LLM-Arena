import { ModelName } from '@/components/shared/controls'
import { Icon, Spinner } from '@/components/shared/icons'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'
import { ReasoningDisclosure } from '@/components/shared/ReasoningDisclosure'
import type { ArenaScore } from '@/services/score-parser'

interface VerdictPanelProps {
  judgeModelId: string
  result: string | null
  reasoningText: string
  isJudging: boolean
  scores: ArenaScore[]
  modelIds: string[]
}

function Leaderboard({ scores, modelIds }: { scores: ArenaScore[]; modelIds: string[] }): JSX.Element {
  const top = Math.max(...scores.map((entry) => entry.score), 1)
  return (
    <ol aria-label="平均總分排名" className="mb-4 space-y-1.5">
      {scores.map((entry) => {
        const isWinner = entry.rank === 1
        return (
          <li key={entry.slotIndex} className="grid grid-cols-[1.5rem_1.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 sm:grid-cols-[1.5rem_1.5rem_minmax(0,14rem)_minmax(0,1fr)_3.5rem]">
            <span className={`num text-center text-[13px] ${isWinner ? 'font-semibold text-accent-text' : 'text-faint'}`}>{entry.rank}</span>
            <span className="token">{String.fromCharCode(65 + entry.slotIndex)}</span>
            <ModelName id={modelIds[entry.slotIndex] ?? ''} className={`text-[13px] ${isWinner ? 'font-medium' : ''}`} />
            <span className="hidden h-1.5 overflow-hidden rounded-full bg-sunken sm:block" aria-hidden="true">
              <span
                className={`block h-full rounded-full transition-[width] duration-500 ease-out ${isWinner ? 'bg-accent' : 'bg-line-strong'}`}
                style={{ width: `${(entry.score / top) * 100}%` }}
              />
            </span>
            <span className={`num text-right text-[13px] ${isWinner ? 'font-semibold' : 'text-muted'}`}>{entry.score.toFixed(2)}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function VerdictPanel({ judgeModelId, result, reasoningText, isJudging, scores, modelIds }: VerdictPanelProps): JSX.Element {
  const isError = Boolean(result?.startsWith('評審錯誤:'))
  return (
    <section aria-label="裁判評分" className="panel card-enter relative overflow-hidden">
      {isJudging && <div className="live-bar" />}
      <header className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <Icon name="scale" className="h-4 w-4 text-muted" />
        <h3 className="text-sm font-semibold">裁判評分</h3>
        <ModelName id={judgeModelId} className="flex-1 text-xs" />
        {isJudging && <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted"><Spinner />評審中</span>}
      </header>
      <div className="p-3.5">
        {scores.length > 0 && !isJudging && <Leaderboard scores={scores} modelIds={modelIds} />}
        <ReasoningDisclosure content={reasoningText} isStreaming={isJudging} />
        {isError && <div role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{result}</div>}
        {!isError && result && <MarkdownRenderer content={result} />}
        {isJudging && !result && !reasoningText && (
          <div className="space-y-2.5 py-1" aria-hidden="true">
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        )}
      </div>
    </section>
  )
}
