import type { Attachment, ContentPart } from '@/types/models'
import { OpenRouterClient } from './openrouter-client'

export async function generateTitle(
  apiUrl: string,
  apiKey: string,
  modelId: string,
  text: string,
  attachments: Attachment[]
): Promise<string> {
  const fallback = text.trim().slice(0, 40) || '未命名對話'

  if (!apiKey || !modelId) return fallback

  const client = new OpenRouterClient(apiUrl, apiKey)
  const imageAttachments = attachments.filter((a) => a.type === 'image')
  const prompt = `請為以下內容生成一個簡短的標題（15字以內，直接輸出標題文字，不要加引號或其他說明）：\n\n${text}`

  let content: string | ContentPart[]
  if (imageAttachments.length > 0) {
    const parts: ContentPart[] = [{ type: 'text', text: prompt }]
    for (const img of imageAttachments) {
      parts.push({ type: 'image_url', image_url: { url: img.content } })
    }
    content = parts
  } else {
    content = prompt
  }

  try {
    const result = await client.chat(modelId, [{ role: 'user', content }])
    const title = result.trim().replace(/^["'「『]|["'」』]$/g, '').slice(0, 40)
    return title || fallback
  } catch {
    return fallback
  }
}
