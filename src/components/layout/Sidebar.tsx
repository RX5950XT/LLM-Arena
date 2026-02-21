import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/stores/theme-store'
import { useHistoryStore } from '@/stores/history-store'
import { useArenaStore } from '@/stores/arena-store'
import { useDebateStore } from '@/stores/debate-store'
import type { ArenaHistoryEntry, DebateHistoryEntry } from '@/types/history'

function IconArena(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
    </svg>
  )
}

function IconDebate(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  )
}

function IconSettings(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

function IconSun(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  )
}

function IconMoon(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  )
}

function IconPlus(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

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

interface HistoryListProps {
  type: 'arena' | 'debate'
}

function HistoryList({ type }: HistoryListProps): JSX.Element {
  const navigate = useNavigate()
  const historyStore = useHistoryStore()
  const arenaStore = useArenaStore()
  const debateStore = useDebateStore()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const history = type === 'arena' ? historyStore.arenaHistory : historyStore.debateHistory
  const activeId = type === 'arena' ? historyStore.activeArenaId : historyStore.activeDebateId

  const handleLoad = (entry: ArenaHistoryEntry | DebateHistoryEntry): void => {
    if (type === 'arena') {
      arenaStore.restoreFromHistory(entry as ArenaHistoryEntry)
      historyStore.setActiveArenaId(entry.id)
      navigate('/')
    } else {
      debateStore.restoreFromHistory(entry as DebateHistoryEntry)
      historyStore.setActiveDebateId(entry.id)
      navigate('/debate')
    }
  }

  const handleNewSession = (): void => {
    if (type === 'arena') {
      arenaStore.resetAll()
      historyStore.setActiveArenaId(null)
      navigate('/')
    } else {
      debateStore.reset()
      historyStore.setActiveDebateId(null)
      navigate('/debate')
    }
  }

  const handleDelete = (e: React.MouseEvent, id: string): void => {
    e.stopPropagation()
    if (type === 'arena') {
      historyStore.deleteArena(id)
    } else {
      historyStore.deleteDebate(id)
    }
  }

  return (
    <div className="mt-1 mb-1.5">
      {/* 新對話按鈕 - 與導覽項目對齊 */}
      <button
        type="button"
        onClick={handleNewSession}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-500/5 dark:hover:bg-primary-500/5 transition-colors cursor-pointer"
        title="清除目前載入的紀錄，開始新對話"
      >
        <span className="shrink-0"><IconPlus /></span>
        <span>新對話</span>
      </button>

      {/* 歷史項目 */}
      {history.length === 0 ? (
        <p className="text-[11px] text-slate-400 dark:text-slate-600 text-center py-3">
          尚無歷史紀錄
        </p>
      ) : (
        <ul className="mt-0.5 space-y-px">
          {history.map((entry) => (
            <li
              key={entry.id}
              className={`group flex items-center gap-1.5 pl-5 pr-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                entry.id === activeId
                  ? 'bg-primary-500/10'
                  : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
              onMouseEnter={() => setHoveredId(entry.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleLoad(entry)}
            >
              {/* 左邊指示線 */}
              <div className={`w-0.5 self-stretch rounded-full shrink-0 ${
                entry.id === activeId
                  ? 'bg-primary-500'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`} />
              <div className="flex-1 min-w-0 pl-1.5">
                <p className={`text-xs truncate leading-snug ${
                  entry.id === activeId
                    ? 'font-medium text-primary-700 dark:text-primary-300'
                    : 'text-slate-600 dark:text-slate-400'
                }`}>
                  {entry.title}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5 leading-none">
                  {formatRelativeTime(entry.updatedAt)}
                </p>
              </div>
              {hoveredId === entry.id && (
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, entry.id)}
                  className="shrink-0 p-0.5 text-slate-400 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                  title="刪除此紀錄"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 筆數資訊 */}
      {history.length > 0 && (
        <p className="text-[10px] text-slate-400 dark:text-slate-600 pl-5 pt-1.5">
          {history.length} / 50
        </p>
      )}
    </div>
  )
}

export function Sidebar(): JSX.Element {
  const { theme, toggleTheme } = useThemeStore()
  const [expanded, setExpanded] = useState<'arena' | 'debate' | null>(null)

  const toggleExpanded = (type: 'arena' | 'debate'): void => {
    setExpanded((prev) => (prev === type ? null : type))
  }

  return (
    <aside className="w-52 shrink-0 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
            LLM Arena
          </h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-2 leading-relaxed">
          大型語言模型競技場
        </p>
      </div>

      {/* 導覽列 */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {/* 模型競技場 */}
        <div>
          <NavLink
            to="/"
            end
            onClick={() => toggleExpanded('arena')}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`
            }
          >
            <span className="shrink-0"><IconArena /></span>
            <span className="flex-1">模型競技場</span>
            <span className="shrink-0 p-0.5 text-slate-400 dark:text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-3 h-3 transition-transform duration-200 ${expanded === 'arena' ? 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </span>
          </NavLink>
          {expanded === 'arena' && <HistoryList type="arena" />}
        </div>

        {/* AI 辯論 */}
        <div>
          <NavLink
            to="/debate"
            onClick={() => toggleExpanded('debate')}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`
            }
          >
            <span className="shrink-0"><IconDebate /></span>
            <span className="flex-1">AI 辯論</span>
            <span className="shrink-0 p-0.5 text-slate-400 dark:text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-3 h-3 transition-transform duration-200 ${expanded === 'debate' ? 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </span>
          </NavLink>
          {expanded === 'debate' && <HistoryList type="debate" />}
        </div>

        {/* 分隔線 */}
        <div className="!my-2 border-t border-slate-200 dark:border-slate-800" />

        {/* 設定 */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              isActive
                ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`
          }
        >
          <span className="shrink-0"><IconSettings /></span>
          <span>設定</span>
        </NavLink>
      </nav>

      {/* 主題切換 */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
        >
          <span className="shrink-0">{theme === 'dark' ? <IconSun /> : <IconMoon />}</span>
          <span>{theme === 'dark' ? '淺色模式' : '深色模式'}</span>
        </button>
      </div>
    </aside>
  )
}
