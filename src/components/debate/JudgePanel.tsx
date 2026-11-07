import { useMemo } from 'react'
import { useDebateStore } from '@/stores/debate-store'
import { ModelName } from '@/components/shared/controls'
import { Icon, Spinner } from '@/components/shared/icons'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'
import { ReasoningDisclosure } from '@/components/shared/ReasoningDisclosure'
import { parseDebateScore } from '@/services/score-parser'
import type { DebateScore } from '@/services/score-parser'
import type { JudgeResult } from '@/types/debate'

const FINAL_JUDGE_INDEX = 3

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '')
}

function getTally(scores: Array<DebateScore | null>): { score: DebateScore; source: string } | null {
  const finalScore = scores[FINAL_JUDGE_INDEX]
  if (finalScore) return { score: finalScore, source: '綜合裁判的最終總分' }
  const available = scores.filter((score): score is DebateScore => score !== null)
  if (available.length === 0) return null
  return {
    score: {
      pro: available.reduce((sum, score) => sum + score.pro, 0) / available.length,
      con: available.reduce((sum, score) => sum + score.con, 0) / available.length
    },
    source: `${available.length} 位裁判的平均分`
  }
}

function ScoreSplit({ score, proModel, conModel, source }: { score: DebateScore; proModel: string; conModel: string; source: string }): JSX.Element {
  const total = score.pro + score.con || 1
  const diff = Math.abs(score.pro - score.con)
  const verdict = diff === 0 ? '雙方平手' : `${score.pro > score.con ? '正方' : '反方'}勝 ${formatScore(diff)} 分`
  return (
    <div className="mb-3 rounded-lg bg-sunken p-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-pro">正方</p>
          <p className={`num text-2xl leading-tight ${score.pro >= score.con ? 'font-semibold' : 'text-muted'}`}>{formatScore(score.pro)}</p>
          <ModelName id={proModel} className="text-[11px]" />
        </div>
        <div className="shrink-0 pb-0.5 text-center">
          <p className="text-[13px] font-semibold">{verdict}</p>
          <p className="text-[11px] text-faint">{source}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-xs font-medium text-con">反方</p>
          <p className={`num text-2xl leading-tight ${score.con >= score.pro ? 'font-semibold' : 'text-muted'}`}>{formatScore(score.con)}</p>
          <ModelName id={conModel} className="text-[11px]" />
        </div>
      </div>
      <div className="mt-2.5 flex h-1.5 gap-0.5" aria-hidden="true">
        <span className="rounded-full bg-pro transition-[width] duration-500 ease-out" style={{ width: `${(score.pro / total) * 100}%` }} />
        <span className="flex-1 rounded-full bg-con" />
      </div>
    </div>
  )
}

function JudgeCard({ judge, score, isFinal }: { judge: JudgeResult; score: DebateScore | null; isFinal: boolean }): JSX.Element {
  return (
    <article className={`relative min-w-0 overflow-hidden rounded-lg border border-line ${isFinal ? 'md:col-span-3' : ''}`}>
      {judge.isStreaming && <div className="live-bar" />}
      <header className="flex items-center gap-2 px-3 pt-2.5">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[13px] font-medium">{judge.name}</h4>
          <ModelName id={judge.modelId} className="text-[11px]" />
        </div>
        {judge.isStreaming && <Spinner />}
        {score && !judge.isStreaming && (
          <span className="num shrink-0 text-[13px]" aria-label={`正方 ${score.pro} 分，反方 ${score.con} 分`}>
            <span className="text-pro">{formatScore(score.pro)}</span>
            <span className="text-faint"> : </span>
            <span className="text-con">{formatScore(score.con)}</span>
          </span>
        )}
      </header>
      <div className={`px-3 pb-3 pt-2 ${isFinal ? '' : 'max-h-80 overflow-y-auto'}`}>
        <ReasoningDisclosure content={judge.reasoningText} isStreaming={judge.isStreaming} />
        {judge.analysis && <MarkdownRenderer content={judge.analysis} />}
        {judge.error && <p role="alert" className="text-[13px] text-danger">{judge.error}</p>}
        {judge.isStreaming && !judge.analysis && !judge.reasoningText && (
          <div className="space-y-2 py-1" aria-hidden="true">
            <div className="skeleton h-2.5 w-full" />
            <div className="skeleton h-2.5 w-2/3" />
          </div>
        )}
      </div>
    </article>
  )
}

export function JudgePanel(): JSX.Element | null {
  const judges = useDebateStore((state) => state.judges)
  const proModel = useDebateStore((state) => state.forModel.modelId)
  const conModel = useDebateStore((state) => state.againstModel.modelId)
  const scoreKey = judges.map((judge) => judge.isStreaming ? '' : judge.analysis).join('\u0000')
  // 只在裁判講完後解析，避免串流途中分數跳動
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scores = useMemo(() => judges.map((judge) => judge.isStreaming ? null : parseDebateScore(judge.analysis)), [scoreKey])
  const hasOutput = judges.some((judge) => judge.analysis || judge.reasoningText || judge.isStreaming || judge.error)
  if (!hasOutput) return null

  const tally = getTally(scores)
  return (
    <section aria-label="裁判評分" className="panel card-enter p-3">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon name="scale" className="h-4 w-4 text-muted" />
        裁判評分
      </h3>
      {tally && <ScoreSplit score={tally.score} proModel={proModel} conModel={conModel} source={tally.source} />}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {judges.map((judge, index) => {
          const hasContent = judge.analysis || judge.reasoningText || judge.isStreaming || judge.error
          return hasContent
            ? <JudgeCard key={judge.name} judge={judge} score={scores[index]} isFinal={index === FINAL_JUDGE_INDEX} />
            : null
        })}
      </div>
    </section>
  )
}
