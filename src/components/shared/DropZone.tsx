import { useCallback, useEffect, useRef, useState } from 'react'
import type { Attachment } from '@/types/models'
import { processDroppedFiles } from '@/services/file-handler'
import { Icon, Spinner } from './icons'

const MAX_TEXTAREA_HEIGHT = 220

interface DropZoneProps {
  attachments: Attachment[]
  onAdd: (attachment: Attachment) => void
  onRemove: (id: string) => void
  userInput: string
  onInputChange: (value: string) => void
  onSend: () => void
  onStop?: () => void
  isSending: boolean
  placeholder?: string
  sendLabel?: string
  sendingLabel?: string
  notice?: string | null
}

function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-sunken py-1 pl-1.5 pr-1 text-xs text-muted">
      {attachment.type === 'image'
        ? <img src={attachment.content} alt={attachment.name} className="h-6 w-6 shrink-0 rounded object-cover" />
        : <Icon name="document" className="h-3.5 w-3.5 shrink-0 text-faint" />}
      <span className="max-w-32 truncate">{attachment.name}</span>
      <button type="button" onClick={onRemove} aria-label={`移除附件 ${attachment.name}`} className="icon-btn !h-5 !w-5 hover:text-danger">
        <Icon name="close" className="h-3 w-3" />
      </button>
    </div>
  )
}

export function DropZone({
  attachments,
  onAdd,
  onRemove,
  userInput,
  onInputChange,
  onSend,
  onStop,
  isSending,
  placeholder = '輸入問題，也可以拖入或貼上檔案、圖片…',
  sendLabel = '發送',
  sendingLabel = '生成中',
  notice
}: DropZoneProps): JSX.Element {
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [userInput])

  const addFiles = useCallback(async (files: FileList | File[]) => {
    try {
      setFileError(null)
      const processed = await processDroppedFiles(files)
      processed.forEach(onAdd)
    } catch (error) {
      console.error('處理檔案錯誤:', error)
      setFileError(error instanceof Error ? error.message : '檔案處理失敗，請換一個檔案再試一次。')
    }
  }, [onAdd])

  const handleDrop = (event: React.DragEvent): void => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files.length > 0) void addFiles(event.dataTransfer.files)
  }

  const handleDragLeave = (event: React.DragEvent): void => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false)
  }

  const handlePaste = (event: React.ClipboardEvent): void => {
    if (event.clipboardData.files.length === 0) return
    event.preventDefault()
    void addFiles(event.clipboardData.files)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (event.target.files && event.target.files.length > 0) void addFiles(event.target.files)
    event.target.value = ''
  }

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !isSending) {
      event.preventDefault()
      onSend()
    }
  }

  const message = notice ?? fileError
  return (
    <div
      className={`relative rounded-xl border bg-panel shadow-pop transition-colors duration-150 focus-within:border-accent/70 ${
        isDragging ? 'border-accent ring-2 ring-accent/25' : 'border-line-strong'
      }`}
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
          {attachments.map((attachment) => (
            <AttachmentChip key={attachment.id} attachment={attachment} onRemove={() => onRemove(attachment.id)} />
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={userInput}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={isDragging ? '放開以加入檔案' : placeholder}
        aria-label={placeholder}
        rows={1}
        className="block max-h-[220px] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-faint"
      />

      <div className="flex items-center gap-2 px-2 pb-2">
        <button type="button" onClick={() => fileInputRef.current?.click()} title="附加檔案" aria-label="附加檔案" className="icon-btn">
          <Icon name="paperclip" />
        </button>
        <input ref={fileInputRef} type="file" multiple accept="image/*,.txt,.md,.json,.csv" onChange={handleFileSelect} className="hidden" />

        <p aria-live="polite" className={`min-w-0 flex-1 truncate text-xs ${message ? 'text-danger' : 'text-faint'}`} title={message ?? undefined}>
          {message ?? <span className="hidden sm:inline">Ctrl + Enter 發送</span>}
        </p>

        {isSending && onStop ? (
          <button type="button" onClick={onStop} title="立即停止目前生成，保留內容並可重新發送" className="btn btn-danger">
            <Icon name="stop" />
            強制暫停
          </button>
        ) : (
          <button type="button" onClick={onSend} disabled={isSending || !userInput.trim()} className="btn btn-primary">
            {isSending ? <Spinner className="h-4 w-4" /> : <Icon name="send" />}
            {isSending ? sendingLabel : sendLabel}
          </button>
        )}
      </div>
    </div>
  )
}
