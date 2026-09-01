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

## 驗證

- `npm run build` 已通過（TypeScript 檢查與 Vite production build）。
- `git diff --check` 已通過。
- 本次以 Playwright mock 串流驗證供應商生成中保存、切換後返回仍看得到內容，以及辯論 PDF 下載；用 `pdftoppm` 渲染 PDF，確認 Markdown 表格、數學公式與 A4 分頁可見，且畫面沒有 reasoning。
- 背景執行器以 `historyId` 分離三種模式的執行狀態，切換對話只更換畫面投影，不會取消其他對話。
