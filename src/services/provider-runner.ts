import { useHistoryStore } from '@/stores/history-store'
import { OpenRouterClient } from './openrouter-client'
import { StreamingManager } from './streaming-manager'
import { buildContentParts } from './file-handler'
import type { Attachment, ChatMessage, ProviderEndpoint } from '@/types/models'
import type { ProviderHistoryResponse, StoredAttachment } from '@/types/history'
import type { StreamTask } from './streaming-manager'

export interface ProviderRunInput {
  apiUrl: string
  apiKey: string
  modelId: string
  systemPrompt: string
  reasoning: boolean
  userInput: string
  attachments: Attachment[]
  endpoints: ProviderEndpoint[]
  selectedSlugs: string[]
}

interface ProviderRun {
  id: string
  input: ProviderRunInput
  responses: Record<string, ProviderHistoryResponse>
  manager: StreamingManager
  stopped: boolean
}

const runs = new Map<string, ProviderRun>()

function toStoredAttachments(attachments: Attachment[]): StoredAttachment[] {
  return attachments.map((attachment) => ({
    ...attachment,
    content: attachment.type === 'image' ? '' : attachment.content,
    isImagePlaceholder: attachment.type === 'image'
  }))
}

function isLive(run: ProviderRun): boolean {
  return runs.get(run.id) === run && !run.stopped
}

function publish(run: ProviderRun): void {
  const { input } = run
  useHistoryStore.getState().updateProvider(run.id, {
    modelId: input.modelId,
    systemPrompt: input.systemPrompt,
    reasoning: input.reasoning,
    userInput: input.userInput,
    attachments: toStoredAttachments(input.attachments),
    endpoints: input.endpoints,
    selectedSlugs: input.selectedSlugs,
    responses: run.responses,
    isSending: true
  })
}

function updateResponse(run: ProviderRun, slug: string, updates: Partial<ProviderHistoryResponse>): void {
  if (!isLive(run) || !run.responses[slug]) return
  run.responses = {
    ...run.responses,
    [slug]: { ...run.responses[slug], ...updates }
  }
  publish(run)
}

function finishedResponses(responses: Record<string, ProviderHistoryResponse>): Record<string, ProviderHistoryResponse> {
  return Object.fromEntries(Object.entries(responses).map(([slug, response]) => [slug, {
    ...response,
    isStreaming: false
  }]))
}

async function runProvider(run: ProviderRun): Promise<void> {
  const { input } = run
  const selectedEndpoints = input.endpoints.filter((endpoint) => input.selectedSlugs.includes(endpoint.slug))
  const messages: ChatMessage[] = []
  if (input.systemPrompt.trim()) messages.push({ role: 'system', content: input.systemPrompt })
  messages.push({ role: 'user', content: buildContentParts(input.userInput, input.attachments) })
  const tasks: StreamTask[] = selectedEndpoints.map((endpoint) => ({
    id: `provider-${endpoint.slug}`,
    modelId: input.modelId,
    messages,
    options: { reasoning: input.reasoning, provider: endpoint.slug },
    callbacks: {
      onToken: (token) => {
        const response = run.responses[endpoint.slug]
        if (response) updateResponse(run, endpoint.slug, { responseText: response.responseText + token })
      },
      onReasoningToken: (token) => {
        const response = run.responses[endpoint.slug]
        if (response) updateResponse(run, endpoint.slug, { reasoningText: (response.reasoningText ?? '') + token })
      },
      onComplete: () => updateResponse(run, endpoint.slug, { isStreaming: false }),
      onError: (error) => updateResponse(run, endpoint.slug, { isStreaming: false, error: error.message })
    }
  }))

  try {
    await run.manager.streamAll(tasks)
  } catch (error) {
    if (isLive(run)) console.error('供應商比較發生錯誤:', error)
  } finally {
    if (isLive(run)) {
      run.responses = finishedResponses(run.responses)
      useHistoryStore.getState().updateProvider(run.id, {
        responses: run.responses,
        isSending: false
      })
      runs.delete(run.id)
    }
  }
}

export function isProviderRunActive(id: string | null): boolean {
  return Boolean(id && runs.has(id))
}

export function stopProviderRun(id: string | null): void {
  const run = id ? runs.get(id) : undefined
  if (!run) return
  run.stopped = true
  run.manager.cancelAll()
  run.responses = finishedResponses(run.responses)
  useHistoryStore.getState().updateProvider(run.id, {
    responses: run.responses,
    isSending: false
  })
  runs.delete(run.id)
}

export function startProviderRun(id: string, input: ProviderRunInput): void {
  stopProviderRun(id)
  const selectedEndpoints = input.endpoints.filter((endpoint) => input.selectedSlugs.includes(endpoint.slug))
  const responses = Object.fromEntries(selectedEndpoints.map((endpoint) => [endpoint.slug, {
    responseText: '',
    reasoningText: '',
    isStreaming: true,
    error: null
  }]))
  const client = new OpenRouterClient(input.apiUrl, input.apiKey)
  const run: ProviderRun = {
    id,
    input,
    responses,
    manager: new StreamingManager(client),
    stopped: false
  }
  runs.set(id, run)
  publish(run)
  void runProvider(run)
}
