import type { ChatMessage, StreamCallbacks, ChatOptions } from '@/types/models'
import { OpenRouterClient } from './openrouter-client'

export interface StreamTask {
  id: string
  modelId: string
  messages: ChatMessage[]
  callbacks: StreamCallbacks
  options?: ChatOptions
}

export class StreamingManager {
  private client: OpenRouterClient
  private abortControllers: Map<string, AbortController> = new Map()

  constructor(client: OpenRouterClient) {
    this.client = client
  }

  async streamAll(tasks: StreamTask[]): Promise<void> {
    const promises = tasks.map((task) => {
      const controller = new AbortController()
      this.abortControllers.set(task.id, controller)

      return this.client
        .streamChat(task.modelId, task.messages, task.callbacks, controller.signal, task.options)
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') return
          task.callbacks.onError(err instanceof Error ? err : new Error(String(err)))
        })
        .finally(() => {
          this.abortControllers.delete(task.id)
        })
    })

    await Promise.allSettled(promises)
  }

  cancelAll(): void {
    for (const controller of this.abortControllers.values()) {
      controller.abort()
    }
    this.abortControllers.clear()
  }

  cancelOne(id: string): void {
    const controller = this.abortControllers.get(id)
    if (controller) {
      controller.abort()
      this.abortControllers.delete(id)
    }
  }
}
