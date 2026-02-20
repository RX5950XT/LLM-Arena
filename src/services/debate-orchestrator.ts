import type { ChatMessage } from '@/types/models'
import type { DebateSide } from '@/types/debate'
import { OpenRouterClient } from './openrouter-client'
import { useDebateStore } from '@/stores/debate-store'
import { buildContentParts } from './file-handler'

export class DebateOrchestrator {
  private client: OpenRouterClient
  private abortController: AbortController | null = null

  constructor(client: OpenRouterClient) {
    this.client = client
  }

  async startDebate(): Promise<void> {
    this.abortController = new AbortController()
    const store = useDebateStore.getState()
    useDebateStore.getState().setStatus('debating')

    try {
      for (let round = 1; round <= store.totalRounds; round++) {
        if (this.abortController.signal.aborted) break
        useDebateStore.getState().setCurrentRound(round)

        // 正方發言
        await this.speak('for', round)
        if (this.abortController.signal.aborted) break

        // 反方發言
        await this.speak('against', round)
      }

      if (!this.abortController.signal.aborted) {
        await this.runJudges()
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('辯論發生錯誤:', err)
    }
  }

  private async speak(side: DebateSide, round: number): Promise<void> {
    const store = useDebateStore.getState()
    useDebateStore.getState().setCurrentSpeaker(side)
    useDebateStore.getState().setCurrentStreamText('')

    const config = side === 'for' ? store.forModel : store.againstModel
    const messages = this.buildMessages(side, store.topic, round)

    let fullText = ''

    const options = { reasoning: config.reasoning ?? false }

    await this.client.streamChat(
      config.modelId,
      messages,
      {
        onToken: (token) => {
          fullText += token
          useDebateStore.getState().appendStreamToken(token)
        },
        onComplete: (text) => {
          useDebateStore.getState().appendMessage({ side, round, content: text })
          useDebateStore.getState().setCurrentSpeaker(null)
        },
        onError: (error) => {
          console.error(`${side} 發言錯誤:`, error)
          if (fullText) {
            useDebateStore.getState().appendMessage({ side, round, content: fullText })
          }
          useDebateStore.getState().setCurrentSpeaker(null)
        }
      },
      this.abortController!.signal,
      options
    )
  }

  private buildMessages(side: DebateSide, topic: string, _round: number): ChatMessage[] {
    const store = useDebateStore.getState()
    const config = side === 'for' ? store.forModel : store.againstModel
    const messages: ChatMessage[] = [
      { role: 'system', content: config.systemPrompt }
    ]

    // 加入附件和議題作為第一條 user 訊息
    const topicContent = buildContentParts(
      `辯論議題：${topic}`,
      store.attachments
    )
    messages.push({ role: 'user', content: topicContent })

    // 加入歷史對話
    for (const msg of store.messages) {
      const role = msg.side === side ? 'assistant' : 'user'
      const label = msg.side === 'for' ? '正方' : '反方'
      messages.push({
        role,
        content: `【第 ${msg.round} 回合 - ${label}】\n${msg.content}`
      })
    }

    // 如果不是第一次發言，加入提示
    if (store.messages.length > 0) {
      const lastMsg = store.messages[store.messages.length - 1]
      if (lastMsg.side !== side) {
        messages.push({
          role: 'user',
          content: '請針對對方的論點進行回應，提出你的下一輪論述。'
        })
      }
    }

    return messages
  }

  private async runJudge(index: number, userContent: string, maxRetries = 3): Promise<void> {
    const judge = useDebateStore.getState().judges[index]
    if (!judge?.modelId) return

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (this.abortController?.signal.aborted) return

      useDebateStore.getState().updateJudge(index, { isStreaming: true, analysis: '', error: null })

      const messages: ChatMessage[] = [
        { role: 'system', content: judge.systemPrompt },
        { role: 'user', content: userContent }
      ]

      try {
        await this.client.streamChat(
          judge.modelId,
          messages,
          {
            onToken: (token) => useDebateStore.getState().appendJudgeToken(index, token),
            onComplete: () => useDebateStore.getState().updateJudge(index, { isStreaming: false }),
            onError: (error) => useDebateStore.getState().updateJudge(index, { isStreaming: false, error: error.message })
          },
          this.abortController?.signal
        )
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : String(err)
        const isLast = attempt === maxRetries
        useDebateStore.getState().updateJudge(index, {
          isStreaming: false,
          error: isLast ? `錯誤：${message}` : `第 ${attempt} 次失敗，${attempt} 秒後重試...`
        })
        if (!isLast) await new Promise((r) => setTimeout(r, attempt * 1000))
      }
    }
  }

  private async runJudges(): Promise<void> {
    useDebateStore.getState().setStatus('judging')
    const store = useDebateStore.getState()

    const debateTranscript = store.messages
      .map((msg) => {
        const label = msg.side === 'for' ? '正方' : '反方'
        return `【第 ${msg.round} 回合 - ${label}】\n${msg.content}`
      })
      .join('\n\n---\n\n')

    const baseUserContent = `辯論議題：${store.topic}\n\n以下是完整的辯論記錄：\n\n${debateTranscript}\n\n請給出你的評分與分析。`

    // 第一階段：前三位裁判並行
    await Promise.allSettled([
      this.runJudge(0, baseUserContent),
      this.runJudge(1, baseUserContent),
      this.runJudge(2, baseUserContent)
    ])

    if (this.abortController?.signal.aborted) {
      useDebateStore.getState().setStatus('completed')
      return
    }

    // 第二階段：綜合評判裁判，附上前三位的評價
    const panelNames = ['邏輯分析裁判', '論據品質裁判', '說服力裁判']
    const panelSection = useDebateStore.getState().judges
      .slice(0, 3)
      .map((j, i) => (j.analysis ? `【${panelNames[i]}】\n${j.analysis}` : null))
      .filter(Boolean)
      .join('\n\n---\n\n')

    const finalUserContent = panelSection
      ? `辯論議題：${store.topic}\n\n以下是完整的辯論記錄：\n\n${debateTranscript}\n\n以下是其他三位裁判的評估意見：\n\n${panelSection}\n\n請給出你的綜合評判與最終總分。`
      : baseUserContent

    await this.runJudge(3, finalUserContent)

    useDebateStore.getState().setStatus('completed')
  }

  stop(): void {
    this.abortController?.abort()
    useDebateStore.getState().setStatus('idle')
    useDebateStore.getState().setCurrentSpeaker(null)
  }
}
