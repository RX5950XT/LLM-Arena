import { create } from 'zustand'

export type StorageArea = 'history' | 'settings'
type AreaStatus = 'ok' | 'failed' | 'dismissed'

interface StorageStatusState {
  history: AreaStatus
  settings: AreaStatus
  dismiss: (area: StorageArea) => void
}

export const useStorageStatus = create<StorageStatusState>((set) => ({
  history: 'ok',
  settings: 'ok',
  dismiss: (area) => set({ [area]: 'dismissed' })
}))

/**
 * 寫入 localStorage 並回報結果。串流時每個片段都會寫一次，所以只有狀態改變才更新畫面；
 * 使用者關掉提示後，要先成功存過一次才會再提示。
 */
export function writeToStorage(area: StorageArea, key: string, value: string): boolean {
  const current = useStorageStatus.getState()[area]
  try {
    localStorage.setItem(key, value)
    if (current !== 'ok') useStorageStatus.setState({ [area]: 'ok' })
    return true
  } catch (error) {
    if (current === 'ok') {
      console.warn('瀏覽器儲存失敗', error)
      useStorageStatus.setState({ [area]: 'failed' })
    }
    return false
  }
}
