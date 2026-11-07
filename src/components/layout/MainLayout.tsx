import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Icon } from '@/components/shared/icons'
import { Sidebar } from './Sidebar'

const COLLAPSED_KEY = 'llm-arena-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function MainLayout(): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsedState] = useState(readCollapsed)

  const setCollapsed = (next: boolean): void => {
    setCollapsedState(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
    } catch (error) {
      console.warn('側欄狀態儲存失敗', error)
    }
  }

  const handleMenuClick = (): void => {
    if (window.matchMedia('(min-width: 768px)').matches) setCollapsed(false)
    else setSidebarOpen(true)
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={collapsed}
        onClose={() => setSidebarOpen(false)}
        onCollapse={() => setCollapsed(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className={`${collapsed ? 'flex' : 'flex md:hidden'} shrink-0 items-center gap-2 border-b border-line bg-sunken px-2 py-1.5`}>
          <button type="button" onClick={handleMenuClick} aria-label="開啟選單" title="開啟選單" className="icon-btn">
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <img src="/llm-arena-mark.png" alt="" aria-hidden="true" className="h-6 w-6 shrink-0 rounded-md bg-white object-contain p-0.5" />
          <span className="text-sm font-semibold">LLM Arena</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
