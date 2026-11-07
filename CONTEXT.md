# LLM Arena 開發交接

## 目前狀態

- `/#/providers` 是 OpenRouter 同模型供應商比較頁：先查詢 `/models/{author}/{slug}/endpoints`，再勾選 1 個以上 endpoint 並行串流。
- `OpenRouterClient` 以 `provider.only` 鎖定單一 provider；SSE 同時解析 `delta.content` 與 `delta.reasoning`、`delta.reasoning_content`、`delta.reasoning_details`。
- `ReasoningDisclosure` 使用原生 `<details>`，思考內容預設折疊；競技場、辯論、供應商比較共用。
- `settings-store` 持久化 `systemPrompts`；設定頁可批量拖入 `.txt`／`.md`，`ModelSlot` 在競技場與供應商比較直接顯示提示詞庫，沒有資料時提供設定入口；競技場可用第一個模型的提示詞一鍵套用到全部模型，裁判不顯示提示詞庫。
- `DropZone` 在三個執行頁共用「強制暫停」按鈕；`arena-runner`、`provider-runner`、`debate-runner` 在頁面外維持背景執行，只有按停止才取消 `StreamingManager`／`DebateOrchestrator`。
- 競技場裁判會同時收到每個比較模型的系統提示詞、使用者問題與模型回答；預設裁判提示詞涵蓋一般任務、指令遵循、角色扮演、創意與安全性。
- 競技場可設定每個模型重複回答 1–5 次；每次回答獨立保存與顯示，裁判需逐次評分並計算同一模型的平均總分。歷史紀錄保存 `repeatCount` 與各次回答，舊紀錄仍可用單次回答格式恢復。
- 歷史資料的新 reasoning 欄位都是 optional 讀取，舊 localStorage 紀錄仍可恢復。
- `history-store` 現在也保存供應商比較；三個執行頁在每次串流更新時寫入 localStorage。切換頁面或對話不會停止舊請求，完成後仍會更新原歷史；只有重新整理／關閉分頁會中斷請求。
- `/debate` 可選正方或反方先開始；`startingSide` 會進入辯論流程、恢復暫存與歷史紀錄，舊紀錄預設正方先開始。
- 辯論裁判版面為前三位專科裁判同列，綜合裁判在下一列；`debate-pdf` 重用既有 Markdown/KaTeX renderer，以瀏覽器畫布產生 A4 PDF，依序輸出辯論訊息與裁判回應且排除 reasoning。

## UI 架構（2026-11 改版）

- 視覺基準：石墨配色，介面只用純灰階，顏色留給正反方與狀態；因為 `accent-text` 和 `ink` 同色，選取狀態不能只靠文字顏色區分。token 集中在 `src/styles/globals.css`；新元件用語意色名（`bg-panel`、`text-muted`…），不要再寫 `slate-*`、`dark:` 或 `primary-*`。
- 正反方顏色 `pro`／`con` 已用 dataviz 驗證工具檢查兩個主題的色盲區分度與對比。
- 三個執行頁共用同一個骨架：設定區（送出後收合成摘要）→ 結果 → 固定在底部的 `DropZone`。
- 側邊欄依目前路由顯示該模式的歷史，`新對話` 保留陣容。
- `.md` 只給畫面用；PDF 走 `plain` 模式，改 Markdown 樣式不會影響 PDF，改 `MarkdownRenderer` 的標記結構則要重新檢查 PDF。

## 模型回應的安全界線

- API Key 在 `localStorage`，所以模型回應一律視為不可信內容。曾實測 `<iframe srcdoc>` 內的程式讀得到金鑰，修法與規則見 `MarkdownRenderer.tsx` 的 `SANITIZE_SCHEMA`。
- 上色（`rehype-highlight`）要排在過濾之後，否則 class 會被清掉。

- CSP 在 `vercel.json`，是過濾之外的第二層；開發伺服器不會套用，要驗證請用 production build 並帶上同樣的 header。Playwright 的 `wait_for_function` 字串寫法會被 CSP 擋下，屬測試工具限制。

## 驗證

- `npm test` 涵蓋公式解析與 HTML 過濾；刻意拿掉過濾或程式碼判斷，測試會失敗。

- `npm run build` 已通過（TypeScript 檢查與 Vite production build）。
- `git diff --check` 已通過。
- 本次以 Playwright mock 串流驗證供應商生成中保存、切換後返回仍看得到內容，以及辯論 PDF 下載；用 `pdftoppm` 渲染 PDF，確認 Markdown 表格、數學公式與 A4 分頁可見，且畫面沒有 reasoning。
- 背景執行器以 `historyId` 分離三種模式的執行狀態，切換對話只更換畫面投影，不會取消其他對話。
