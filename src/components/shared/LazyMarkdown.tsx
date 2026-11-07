import { lazy, Suspense } from 'react'

interface LazyMarkdownProps {
  content: string
  className?: string
}

function PlainText({ content, className = '' }: LazyMarkdownProps): JSX.Element {
  return <div className={`whitespace-pre-wrap break-words text-sm ${className}`}>{content}</div>
}

function loadRenderer(): Promise<{ default: typeof PlainText }> {
  return import('./MarkdownRenderer')
    .then((module) => ({ default: module.MarkdownRenderer }))
    .catch((error: unknown) => {
      // 通常是分頁開著時網站更新、舊檔案不見了。退回純文字，內容仍看得到，重新整理就恢復。
      console.warn('Markdown 排版載入失敗，暫時顯示純文字', error)
      return { default: PlainText }
    })
}

const Renderer = lazy(loadRenderer)

/** 首屏畫完再抓，第一則回應出現時通常已經載好 */
export function preloadMarkdown(): void {
  void loadRenderer()
}

/** Markdown、公式與程式碼上色的程式很大，首屏用不到，要顯示回應時才載入；載入前先顯示純文字 */
export function LazyMarkdown(props: LazyMarkdownProps): JSX.Element {
  return (
    <Suspense fallback={<PlainText {...props} />}>
      <Renderer {...props} />
    </Suspense>
  )
}
