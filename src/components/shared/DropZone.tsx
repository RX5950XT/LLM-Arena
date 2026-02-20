import { useCallback, useState, useRef } from 'react'
import type { Attachment } from '@/types/models'
import { processDroppedFiles } from '@/services/file-handler'

interface DropZoneProps {
  attachments: Attachment[]
  onAdd: (attachment: Attachment) => void
  onRemove: (id: string) => void
  userInput: string
  onInputChange: (value: string) => void
  onSend: () => void
  isSending: boolean
  placeholder?: string
}

function IconPaperclip(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
    </svg>
  )
}

function IconPhoto(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  )
}

function IconDocument(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

function IconX(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function IconSend(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
    </svg>
  )
}

export function DropZone({
  attachments,
  onAdd,
  onRemove,
  userInput,
  onInputChange,
  onSend,
  isSending,
  placeholder = '輸入問題，或拖入檔案/圖片...'
}: DropZoneProps): JSX.Element {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        try {
          const processed = await processDroppedFiles(e.dataTransfer.files)
          for (const att of processed) {
            onAdd(att)
          }
        } catch (err) {
          console.error('處理檔案錯誤:', err)
        }
      }
    },
    [onAdd]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        try {
          const processed = await processDroppedFiles(e.target.files)
          for (const att of processed) {
            onAdd(att)
          }
        } catch (err) {
          console.error('處理檔案錯誤:', err)
        }
      }
      e.target.value = ''
    },
    [onAdd]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isSending) {
        e.preventDefault()
        onSend()
      }
    },
    [onSend, isSending]
  )

  return (
    <div
      className={`border rounded-xl transition-colors ${
        isDragging
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2.5 pb-0">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group relative flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-600 dark:text-slate-400"
            >
              {att.type === 'image' ? (
                <img
                  src={att.content}
                  alt={att.name}
                  className="w-6 h-6 rounded object-cover shrink-0"
                />
              ) : (
                <span className="text-slate-400 dark:text-slate-500">
                  <IconDocument />
                </span>
              )}
              <span className="max-w-28 truncate">{att.name}</span>
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer ml-0.5"
                aria-label="移除附件"
              >
                <IconX />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-2.5">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          title="附加檔案"
          aria-label="附加檔案"
        >
          <IconPaperclip />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.txt,.md,.json,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <textarea
          value={userInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className="flex-1 px-2 py-1.5 text-sm bg-transparent outline-none resize-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
        />
        <button
          onClick={onSend}
          disabled={isSending || !userInput.trim()}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          aria-label="發送"
        >
          {isSending ? (
            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <IconSend />
          )}
          <span>{isSending ? '生成中' : '發送'}</span>
        </button>
      </div>

      {isDragging && (
        <div className="px-3 pb-2 text-xs text-primary-600 dark:text-primary-400 font-medium">
          放開以加入檔案
        </div>
      )}
      <div className="px-3 pb-2 text-xs text-slate-400 dark:text-slate-600">
        Ctrl + Enter 發送 · 支援拖放圖片與文字檔案
      </div>
    </div>
  )
}
