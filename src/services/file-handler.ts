import type { Attachment, ContentPart } from '@/types/models'
import { SUPPORTED_IMAGE_TYPES, SUPPORTED_TEXT_TYPES, MAX_FILE_SIZE } from '@/constants/config'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(`無法讀取檔案: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export async function processDroppedFiles(files: FileList | File[]): Promise<Attachment[]> {
  const results: Attachment[] = []
  const fileArray = Array.from(files)

  for (const file of fileArray) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`檔案「${file.name}」超過 20MB 大小限制`)
    }

    const isImage = SUPPORTED_IMAGE_TYPES.includes(file.type)
    const isText =
      SUPPORTED_TEXT_TYPES.includes(file.type) ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.json') ||
      file.name.endsWith('.csv')

    if (isImage) {
      const base64 = await fileToBase64(file)
      results.push({
        id: crypto.randomUUID(),
        type: 'image',
        name: file.name,
        mimeType: file.type,
        content: base64,
        size: file.size
      })
    } else if (isText) {
      const text = await file.text()
      results.push({
        id: crypto.randomUUID(),
        type: 'text',
        name: file.name,
        mimeType: file.type || 'text/plain',
        content: text,
        size: file.size
      })
    }
  }

  return results
}

export function buildContentParts(
  text: string,
  attachments: Attachment[]
): string | ContentPart[] {
  if (attachments.length === 0) return text

  const parts: ContentPart[] = []

  for (const att of attachments) {
    if (att.type === 'text') {
      parts.push({ type: 'text', text: `[附件: ${att.name}]\n${att.content}` })
    }
  }

  parts.push({ type: 'text', text })

  for (const att of attachments) {
    if (att.type === 'image') {
      parts.push({ type: 'image_url', image_url: { url: att.content } })
    }
  }

  return parts
}
