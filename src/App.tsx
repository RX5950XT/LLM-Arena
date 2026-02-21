import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { ArenaPage } from '@/components/arena/ArenaPage'
import { DebatePage } from '@/components/debate/DebatePage'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { initTheme } from '@/stores/theme-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useHistoryStore } from '@/stores/history-store'

export function App(): JSX.Element {
  useEffect(() => {
    initTheme()
    useSettingsStore.getState().loadSettings()
    useHistoryStore.getState().loadHistory()
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<ArenaPage />} />
          <Route path="/debate" element={<DebatePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
