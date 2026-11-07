import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/shared/icons'
import type { IconName } from '@/components/shared/icons'
import { useThemeStore } from '@/stores/theme-store'
import { useHistoryStore } from '@/stores/history-store'
import { useArenaStore } from '@/stores/arena-store'
import { useDebateStore } from '@/stores/debate-store'
import { getArenaRunSnapshot, stopArenaRun } from '@/services/arena-runner'
import { getDebateRunSnapshot, stopDebateRun } from '@/services/debate-runner'
import { isProviderRunActive, stopProviderRun } from '@/services/provider-runner'
import type { ArenaHistoryEntry, DebateHistoryEntry, ProviderHistoryEntry } from '@/types/history'

type HistoryType = 'arena' | 'debate' | 'provider'
type HistoryEntry = ArenaHistoryEntry | DebateHistoryEntry | ProviderHistoryEntry

const NAV_ITEMS: Array<{ to: string; label: string; icon: IconName; type: HistoryType }> = [
  { to: '/', label: '模型競技場', icon: 'arena', type: 'arena' },
  { to: '/debate', label: 'AI 辯論', icon: 'debate', type: 'debate' },
  { to: '/providers', label: '供應商比較', icon: 'providers', type: 'provider' }
]
const SEARCH_MIN_ENTRIES = 6
const DELETE_CONFIRM_MS = 3000

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes} 分鐘前`
  if (hours < 24) return `${hours} 小時前`
  if (days < 30) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString('zh-TW')
}

function groupLabel(timestamp: number, now: Date): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dayMs = 86400000
  if (timestamp >= startOfToday) return '今天'
  if (timestamp >= startOfToday - dayMs) return '昨天'
  if (timestamp >= startOfToday - dayMs * 7) return '這週'
  return '更早'
}

function groupEntries(entries: HistoryEntry[]): Array<{ label: string; entries: HistoryEntry[] }> {
  const now = new Date()
  return entries.reduce<Array<{ label: string; entries: HistoryEntry[] }>>((groups, entry) => {
    const label = groupLabel(entry.updatedAt, now)
    const last = groups[groups.length - 1]
    if (last?.label === label) return [...groups.slice(0, -1), { label, entries: [...last.entries, entry] }]
    return [...groups, { label, entries: [entry] }]
  }, [])
}

function isEntryLive(type: HistoryType, id: string): boolean {
  if (type === 'arena') return Boolean(getArenaRunSnapshot(id))
  if (type === 'debate') return Boolean(getDebateRunSnapshot(id))
  return isProviderRunActive(id)
}

function HistoryRow({ entry, isActive, isLive, onLoad, onDelete }: {
  entry: HistoryEntry
  isActive: boolean
  isLive: boolean
  onLoad: () => void
  onDelete: () => void
}): JSX.Element {
  const [isConfirming, setIsConfirming] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const handleDelete = (): void => {
    if (isConfirming) {
      onDelete()
      return
    }
    setIsConfirming(true)
    timerRef.current = setTimeout(() => setIsConfirming(false), DELETE_CONFIRM_MS)
  }

  return (
    <li className={`group relative rounded-lg transition-colors duration-150 ${isActive ? 'bg-accent/10' : 'hover:bg-panel'}`}>
      <button type="button" onClick={onLoad} aria-current={isActive ? 'true' : undefined} className="block w-full cursor-pointer rounded-lg py-1.5 pl-2.5 pr-8 text-left">
        <span className={`flex items-center gap-1.5 text-[13px] leading-snug ${isActive ? 'font-medium text-ink' : 'text-muted'}`}>
          {isLive && <span className="live-dot" title="生成中" />}
          <span className="truncate" title={entry.title}>{entry.title}</span>
        </span>
        <span className="mt-0.5 block text-[11px] leading-none text-faint">{formatRelativeTime(entry.updatedAt)}</span>
      </button>
      <button
        type="button"
        onClick={handleDelete}
        aria-label={isConfirming ? `確定刪除 ${entry.title}` : `刪除 ${entry.title}`}
        title={isConfirming ? '再按一次確定刪除' : '刪除此紀錄'}
        className={`absolute right-1 top-1/2 -translate-y-1/2 ${
          isConfirming
            ? 'btn btn-danger !h-6 !px-1.5 !text-[11px]'
            : 'icon-btn reveal !h-6 !w-6 hover:!text-danger'
        }`}
      >
        {isConfirming ? '確定？' : <Icon name="close" className="h-3.5 w-3.5" />}
      </button>
    </li>
  )
}

function HistoryPanel({ type, onClose }: { type: HistoryType; onClose: () => void }): JSX.Element {
  const navigate = useNavigate()
  const historyStore = useHistoryStore()
  const [query, setQuery] = useState('')

  const history: HistoryEntry[] = type === 'arena'
    ? historyStore.arenaHistory
    : type === 'debate' ? historyStore.debateHistory : historyStore.providerHistory
  const activeId = type === 'arena'
    ? historyStore.activeArenaId
    : type === 'debate' ? historyStore.activeDebateId : historyStore.activeProviderId
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term ? history.filter((entry) => entry.title.toLowerCase().includes(term)) : history
  }, [history, query])

  const handleLoad = (entry: HistoryEntry): void => {
    if (type === 'arena') {
      historyStore.setActiveArenaId(entry.id)
      const snapshot = getArenaRunSnapshot(entry.id)
      if (snapshot) useArenaStore.setState(snapshot)
      else useArenaStore.getState().restoreFromHistory(entry as ArenaHistoryEntry)
      navigate('/')
    } else if (type === 'debate') {
      historyStore.setActiveDebateId(entry.id)
      const snapshot = getDebateRunSnapshot(entry.id)
      if (snapshot) useDebateStore.setState(snapshot)
      else useDebateStore.getState().restoreFromHistory(entry as DebateHistoryEntry)
      navigate('/debate')
    } else {
      historyStore.setActiveProviderId(entry.id)
      navigate('/providers')
    }
    onClose()
  }

  const handleNewSession = (): void => {
    if (type === 'arena') {
      useArenaStore.getState().resetAll()
      historyStore.setActiveArenaId(null)
      navigate('/')
    } else if (type === 'debate') {
      useDebateStore.getState().reset()
      historyStore.setActiveDebateId(null)
      navigate('/debate')
    } else {
      historyStore.setActiveProviderId(null)
      navigate('/providers')
    }
    onClose()
  }

  const handleDelete = (id: string): void => {
    if (type === 'arena') {
      stopArenaRun(id)
      historyStore.deleteArena(id)
    } else if (type === 'debate') {
      stopDebateRun(id)
      historyStore.deleteDebate(id)
    } else {
      stopProviderRun(id)
      historyStore.deleteProvider(id)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-1.5 px-2 pb-2">
        <button type="button" onClick={handleNewSession} title="清空問題與回覆，保留目前陣容" className="btn btn-outline w-full !justify-start bg-panel">
          <Icon name="plus" />
          新對話
        </button>
        {history.length >= SEARCH_MIN_ENTRIES && (
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋紀錄"
              aria-label="搜尋歷史紀錄"
              className="field !h-8 !bg-transparent pl-8"
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {history.length === 0 && <p className="px-2.5 py-2 text-xs leading-relaxed text-faint">送出第一個問題後，紀錄會出現在這裡。</p>}
        {history.length > 0 && filtered.length === 0 && <p className="px-2.5 py-2 text-xs text-faint">找不到符合「{query}」的紀錄</p>}
        {groupEntries(filtered).map((group) => (
          <div key={group.label} className="mb-2">
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-faint">{group.label}</p>
            <ul className="space-y-px">
              {group.entries.map((entry) => (
                <HistoryRow
                  key={entry.id}
                  entry={entry}
                  isActive={entry.id === activeId}
                  isLive={isEntryLive(type, entry.id)}
                  onLoad={() => handleLoad(entry)}
                  onDelete={() => handleDelete(entry.id)}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

interface SidebarProps {
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onCollapse: () => void
}

function navClass({ isActive }: { isActive: boolean }): string {
  return `flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150 ${
    isActive ? 'bg-accent/15 text-accent-text' : 'text-muted hover:bg-panel hover:text-ink'
  }`
}

export function Sidebar({ isOpen, isCollapsed, onClose, onCollapse }: SidebarProps): JSX.Element {
  const { theme, toggleTheme } = useThemeStore()
  const { pathname } = useLocation()
  const [lastType, setLastType] = useState<HistoryType>('arena')
  const routeType = NAV_ITEMS.find((item) => item.to === pathname)?.type

  useEffect(() => {
    if (routeType) setLastType(routeType)
  }, [routeType])

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-line bg-sunken
      transition-transform duration-200 ease-out md:relative
      ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      ${isCollapsed ? 'md:hidden' : ''}
    `}>
      <div className="flex items-center gap-2 px-3 py-3">
        <img src="/llm-arena-mark.png" alt="" aria-hidden="true" className="h-7 w-7 shrink-0 rounded-lg bg-white object-contain p-0.5" />
        <h1 className="flex-1 text-sm font-semibold">LLM Arena</h1>
        <button type="button" onClick={onCollapse} aria-label="收起側欄" title="收起側欄" className="icon-btn hidden md:inline-flex">
          <Icon name="panel" />
        </button>
        <button type="button" onClick={onClose} aria-label="關閉選單" className="icon-btn md:hidden">
          <Icon name="close" />
        </button>
      </div>

      <nav aria-label="主要功能" className="space-y-0.5 px-2 pb-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end onClick={onClose} className={navClass}>
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <HistoryPanel type={routeType ?? lastType} onClose={onClose} />

      <div className="flex items-center gap-1 border-t border-line p-2">
        <NavLink to="/settings" onClick={onClose} className={(state) => `${navClass(state)} flex-1`}>
          <Icon name="settings" />
          設定
        </NavLink>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? '切換到淺色模式' : '切換到深色模式'}
          title={theme === 'dark' ? '切換到淺色模式' : '切換到深色模式'}
          className="icon-btn !h-9 !w-9"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </aside>
  )
}
