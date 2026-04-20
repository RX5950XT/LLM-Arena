import type { ChatMessage, StreamCallbacks, ChatOptions } from '@/types/models'

export class OpenRouterClient {
  private apiUrl: string
  private apiKey: string

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl
    this.apiKey = apiKey
  }

  private buildBody(
    modelId: string,
    messages: ChatMessage[],
    stream: boolean,
    options?: ChatOptions
  ): Record<string, unknown> {
    const body: Record<string, unknown> = { model: modelId, messages, stream }
    if (options?.reasoning === true) {
      body.reasoning = { effort: 'high' }
    } else if (options?.reasoning === false) {
      body.reasoning = { enabled: false }
    }
    return body
  }

  private async doStreamChat(
    modelId: string,
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
    options?: ChatOptions
  ): Promise<void> {
    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://llm-arena.local',
        'X-Title': 'LLM Arena'
      },
      body: JSON.stringify(this.buildBody(modelId, messages, true, options)),
      signal
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw new Error(`API 錯誤 (${response.status}): ${errorText}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue
          if (!trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            callbacks.onComplete(fullText)
            return
          }

          try {
            const parsed = JSON.parse(data)
            const token = parsed.choices?.[0]?.delta?.content
            if (token) {
              fullText += token
              callbacks.onToken(token)
            }
          } catch {
            // 忽略不完整的 JSON 行
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    callbacks.onComplete(fullText)
  }

  async streamChat(
    modelId: string,
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
    options?: ChatOptions,
    maxRetries = 2
  ): Promise<void> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal?.aborted) throw new Error('已取消')
      try {
        await this.doStreamChat(modelId, messages, callbacks, signal, options)
        return
      } catch (err) {
        if (signal?.aborted) throw err
        // Only retry on network errors (TypeError), not HTTP errors or API errors
        const isNetworkError = err instanceof TypeError
        if (!isNetworkError || attempt === maxRetries) throw err
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
      }
    }
  }

  async chat(
    modelId: string,
    messages: ChatMessage[],
    signal?: AbortSignal,
    options?: ChatOptions
  ): Promise<string> {
    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://llm-arena.local',
        'X-Title': 'LLM Arena'
      },
      body: JSON.stringify(this.buildBody(modelId, messages, false, options)),
      signal
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw new Error(`API 錯誤 (${response.status}): ${errorText}`)
    }

    const result = await response.json()
    return result.choices?.[0]?.message?.content || ''
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://llm-arena.local',
          'X-Title': 'LLM Arena'
        }
      })

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
}
