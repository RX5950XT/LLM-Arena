import type { ChatMessage, ContentPart } from '@/types/models'
import type { DebateSide, DebateState } from '@/types/debate'
import { OpenRouterClient } from './openrouter-client'
import { buildContentParts } from './file-handler'

export class DebateOrchestrator {
  private client: OpenRouterClient
  private state: DebateState
  private abortController: AbortController | null = null
  private onStateChange?: (state: DebateState) => void

  constructor(client: OpenRouterClient, initialState: DebateState, onStateChange?: (state: DebateState) => void) {
    this.client = client
    this.state = initialState
    this.onStateChange = onStateChange
  }

  getState(): DebateState {
    return this.state
  }

  private notify(): void {
    this.onStateChange?.(this.state)
  }

  private update(updater: (state: DebateState) => DebateState): void {
    this.state = updater(this.state)
    this.notify()
  }

  async startDebate(): Promise<boolean> {
    const controller = new AbortController()
    this.abortController = controller
    const firstSide = this.state.startingSide
    const secondSide: DebateSide = firstSide === 'for' ? 'against' : 'for'
    this.update((state) => ({ ...state, status: 'debating' }))

    try {
      for (let round = 1; round <= this.state.totalRounds; round++) {
        if (controller.signal.aborted) break
        this.update((state) => ({ ...state, currentRound: round }))

        await this.speak(firstSide, round, controller.signal)
        if (controller.signal.aborted) break
        await this.speak(secondSide, round, controller.signal)
      }

      if (!controller.signal.aborted) await this.runJudges(controller.signal)
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return false
      console.error('辯論發生錯誤:', error)
      return false
    }

    return !controller.signal.aborted
  }

  private async speak(side: DebateSide, round: number, signal: AbortSignal): Promise<void> {
    const config = side === 'for' ? this.state.forModel : this.state.againstModel
    const messages = this.buildMessages(side)
    this.update((state) => ({
      ...state,
      currentSpeaker: side,
      currentStreamText: '',
      currentStreamReasoningText: ''
    }))

    let fullText = ''
    let reasoningText = ''
    await this.client.streamChat(
      config.modelId,
      messages,
      {
        onToken: (token) => {
          if (signal.aborted) return
          fullText += token
          this.update((state) => ({ ...state, currentStreamText: state.currentStreamText + token }))
        },
        onReasoningToken: (token) => {
          if (signal.aborted) return
          reasoningText += token
          this.update((state) => ({
            ...state,
            currentStreamReasoningText: state.currentStreamReasoningText + token
          }))
        },
        onComplete: (text) => {
          if (signal.aborted) return
          this.update((state) => ({
            ...state,
            messages: [...state.messages, { side, round, content: text, reasoningText }],
            currentSpeaker: null,
            currentStreamText: '',
            currentStreamReasoningText: ''
          }))
        },
        onError: (error) => {
          if (signal.aborted) return
          console.error(`${side} 發言錯誤:`, error)
          this.update((state) => ({
            ...state,
            messages: fullText || reasoningText
              ? [...state.messages, { side, round, content: fullText, reasoningText }]
              : state.messages,
            currentSpeaker: null,
            currentStreamText: '',
            currentStreamReasoningText: ''
          }))
        }
      },
      signal,
      { reasoning: config.reasoning ?? false }
    )
  }

  private buildMessages(side: DebateSide): ChatMessage[] {
    const config = side === 'for' ? this.state.forModel : this.state.againstModel
    const messages: ChatMessage[] = [{ role: 'system', content: config.systemPrompt }]
    messages.push({
      role: 'user',
      content: buildContentParts(`辯論議題：${this.state.topic}`, this.state.attachments)
    })

    for (const message of this.state.messages) {
      const role = message.side === side ? 'assistant' : 'user'
      const label = message.side === 'for' ? '正方' : '反方'
      messages.push({
        role,
        content: `【第 ${message.round} 回合 - ${label}】\n${message.content}`
      })
    }

    if (this.state.messages.length > 0) {
      const lastMessage = this.state.messages[this.state.messages.length - 1]
      if (lastMessage.side !== side) {
        messages.push({ role: 'user', content: '請針對對方的論點進行回應，提出你的下一輪論述。' })
      }
    }
    return messages
  }

  private async runJudge(index: number, userContent: string | ContentPart[], signal: AbortSignal, maxRetries = 3): Promise<void> {
    const judge = this.state.judges[index]
    if (!judge?.modelId) return
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (signal.aborted) return
      this.update((state) => ({
        ...state,
        judges: state.judges.map((item, itemIndex) => itemIndex === index
          ? { ...item, isStreaming: true, analysis: '', reasoningText: '', error: null }
          : item)
      }))

      try {
        await this.client.streamChat(
          judge.modelId,
          [
            { role: 'system', content: judge.systemPrompt },
            { role: 'user', content: userContent }
          ],
          {
            onToken: (token) => {
              if (signal.aborted) return
              this.update((state) => ({
                ...state,
                judges: state.judges.map((item, itemIndex) => itemIndex === index
                  ? { ...item, analysis: item.analysis + token }
                  : item)
              }))
            },
            onReasoningToken: (token) => {
              if (signal.aborted) return
              this.update((state) => ({
                ...state,
                judges: state.judges.map((item, itemIndex) => itemIndex === index
                  ? { ...item, reasoningText: item.reasoningText + token }
                  : item)
              }))
            },
            onComplete: () => {
              if (signal.aborted) return
              this.update((state) => ({
                ...state,
                judges: state.judges.map((item, itemIndex) => itemIndex === index
                  ? { ...item, isStreaming: false }
                  : item)
              }))
            },
            onError: (error) => {
              if (signal.aborted) return
              this.update((state) => ({
                ...state,
                judges: state.judges.map((item, itemIndex) => itemIndex === index
                  ? { ...item, isStreaming: false, error: error.message }
                  : item)
              }))
            }
          },
          signal
        )
        return
      } catch (error) {
        if (signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        const isLast = attempt === maxRetries
        this.update((state) => ({
          ...state,
          judges: state.judges.map((item, itemIndex) => itemIndex === index
            ? { ...item, isStreaming: false, error: isLast ? `錯誤：${message}` : `第 ${attempt} 次失敗，${attempt} 秒後重試...` }
            : item)
        }))
        if (!isLast) await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
      }
    }
  }

  private async runJudges(signal: AbortSignal): Promise<void> {
    this.update((state) => ({ ...state, status: 'judging' }))
    const debateTranscript = this.state.messages
      .map((message) => {
        const label = message.side === 'for' ? '正方' : '反方'
        return `【第 ${message.round} 回合 - ${label}】\n${message.content}`
      })
      .join('\n\n---\n\n')
    const baseText = `辯論議題：${this.state.topic}\n\n以下是完整的辯論記錄：\n\n${debateTranscript}\n\n請給出你的評分與分析。`
    const baseUserContent = buildContentParts(baseText, this.state.attachments)

    await Promise.all([
      this.runJudge(0, baseUserContent, signal),
      this.runJudge(1, baseUserContent, signal),
      this.runJudge(2, baseUserContent, signal)
    ])
    if (signal.aborted) {
      this.update((state) => ({ ...state, status: 'idle' }))
      return
    }

    const panelNames = ['邏輯分析裁判', '論據品質裁判', '說服力裁判']
    const panelSection = this.state.judges
      .slice(0, 3)
      .map((judge, index) => judge.analysis ? `【${panelNames[index]}】\n${judge.analysis}` : null)
      .filter(Boolean)
      .join('\n\n---\n\n')
    const finalText = panelSection
      ? `${baseText.replace('請給出你的評分與分析。', `以下是其他三位裁判的評估意見：\n\n${panelSection}\n\n請給出你的綜合評判與最終總分。`)}`
      : baseText
    await this.runJudge(3, buildContentParts(finalText, this.state.attachments), signal)

    if (signal.aborted) {
      this.update((state) => ({ ...state, status: 'idle' }))
      return
    }
    this.update((state) => ({ ...state, status: 'completed' }))
  }

  stop(): void {
    this.abortController?.abort()
    this.update((state) => ({
      ...state,
      status: 'idle',
      judges: state.judges.map((judge) => judge.isStreaming ? { ...judge, isStreaming: false } : judge)
    }))
  }
}
