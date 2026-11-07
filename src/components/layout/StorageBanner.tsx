import { Link } from 'react-router-dom'
import { Icon } from '@/components/shared/icons'
import { useSettingsStore } from '@/stores/settings-store'
import { useStorageStatus, type StorageArea } from '@/stores/storage-status'

function BannerRow({ area, children }: { area: StorageArea; children: React.ReactNode }): JSX.Element {
  const dismiss = useStorageStatus((state) => state.dismiss)
  return (
    <div role="alert" className="flex items-center gap-2.5 border-b border-warn/40 bg-warn/10 py-1.5 pl-3 pr-1.5 text-[13px]">
      <Icon name="warning" className="h-4 w-4 shrink-0 text-warn" />
      <span className="min-w-0 flex-1">{children}</span>
      <button type="button" onClick={() => dismiss(area)} aria-label="關閉提示" className="icon-btn"><Icon name="close" /></button>
    </div>
  )
}

/** 瀏覽器存不下資料時提示，否則使用者要等重新整理、紀錄消失了才會發現 */
export function StorageBanner(): JSX.Element | null {
  const history = useStorageStatus((state) => state.history)
  const settings = useStorageStatus((state) => state.settings)
  const saveSettings = useSettingsStore((state) => state.saveSettings)

  return (
    <>
      {settings === 'failed' && (
        <BannerRow area="settings">
          設定（含 API Key）存不進瀏覽器，重新整理後會消失。先刪掉一些舊對話，再
          <button type="button" onClick={saveSettings} className="tap font-semibold underline">重新儲存</button>。
        </BannerRow>
      )}
      {history === 'failed' && (
        <BannerRow area="history">
          瀏覽器儲存空間滿了，新的對話紀錄存不進去，重新整理後會消失。可到
          <Link to="/settings" className="tap font-semibold underline">設定</Link>
          匯出備份，再從側欄刪掉舊對話。
        </BannerRow>
      )}
    </>
  )
}
