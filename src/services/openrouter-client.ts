import type { ChatMessage, StreamCallbacks, ChatOptions, ProviderEndpoint } from '@/types/models'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function parseEndpoint(value: unknown): ProviderEndpoint | null {
  if (!isRecord(value)) return null

  const slug = typeof value.tag === 'string' ? value.tag.trim() : ''
  if (!slug) return null

  const name = typeof value.provider_name === 'string'
    ? value.provider_name
    : typeof value.name === 'string' ? value.name : slug
  const pricing = isRecord(value.pricing) ? value.pricing : {}

  return {
    slug,
    name,
    contextLength: toNumber(value.context_length),
    maxCompletionTokens: toNumber(value.max_completion_tokens),
    promptPrice: toNumber(pricing.prompt),
    completionPrice: toNumber(pricing.completion)
  }
}

function getReasoningDelta(delta: unknown): string {
  if (!isRecord(delta)) return ''

  for (const key of ['reasoning', 'reasoning_content']) {
    if (typeof delta[key] === 'string') return delta[key]
  }

  if (!Array.isArray(delta.reasoning_details)) return ''
  return delta.reasoning_details
    .filter(isRecord)
    .map((detail) => {
      if (typeof detail.text === 'string') return detail.text
      if (typeof detail.summary === 'string') return detail.summary
      return ''
    })
    .join('')
}

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
    if (options?.provider) {
      body.provider = { only: [options.provider] }
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
            const delta = parsed.choices?.[0]?.delta
            const reasoning = getReasoningDelta(delta)
            if (reasoning) {
              callbacks.onReasoningToken?.(reasoning)
            }

            const token = delta?.content
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

  async getModelEndpoints(modelId: string, signal?: AbortSignal): Promise<ProviderEndpoint[]> {
    const trimmed = modelId.trim()
    const separator = trimmed.indexOf('/')
    if (separator <= 0 || separator === trimmed.length - 1) {
      throw new Error('模型 ID 必須是 author/model 格式')
    }

    const author = trimmed.slice(0, separator)
    const slug = trimmed.slice(separator + 1)
    const response = await fetch(
      `${this.apiUrl}/models/${encodeURIComponent(author)}/${encodeURIComponent(slug)}/endpoints`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://llm-arena.local',
          'X-Title': 'LLM Arena'
        },
        signal
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw new Error(`供應商清單錯誤 (${response.status}): ${errorText}`)
    }

    const result: unknown = await response.json()
    const data = isRecord(result) && isRecord(result.data) ? result.data : null
    if (!data || !Array.isArray(data.endpoints)) return []

    const unique = new Map<string, ProviderEndpoint>()
    for (const endpoint of data.endpoints) {
      const parsed = parseEndpoint(endpoint)
      if (parsed) unique.set(parsed.slug, parsed)
    }
    return [...unique.values()]
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
