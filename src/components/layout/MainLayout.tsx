import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function MainLayout(): JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
