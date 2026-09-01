export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

export interface ContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface Attachment {
  id: string
  type: 'image' | 'text'
  name: string
  mimeType: string
  content: string
  size: number
}

export interface ModelConfig {
  modelId: string
  systemPrompt: string
  reasoning?: boolean
}

export interface ChatOptions {
  reasoning?: boolean
  provider?: string
}

export interface ProviderEndpoint {
  slug: string
  name: string
  contextLength: number | null
  maxCompletionTokens: number | null
  promptPrice: number | null
  completionPrice: number | null
}

export interface SystemPrompt {
  id: string
  name: string
  content: string
}

export interface StreamCallbacks {
  onToken: (token: string) => void
  onReasoningToken?: (token: string) => void
  onComplete: (fullText: string) => void
  onError: (error: Error) => void
}
