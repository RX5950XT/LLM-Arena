# LLM Arena todo
最後更新：2026-11-19

技術棧、目錄、架構重點與 UI 功能見 `CLAUDE.md`；對外說明見 `README.md`。本檔只放交接重點。

## 現況（交接）
- 三種模式：競技場（`/`，1–15 模型、每模型重複 1–5 次、裁判逐次評分取平均）、供應商比較（`/providers`，1 家以上）、辯論（`/debate`，可選起始方、三專科裁判＋綜合裁判、PDF 匯出）。
- 供應商比較：先查 `/models/{author}/{slug}/endpoints`，再以 `provider.only` 鎖定單一 provider，避免 fallback 到別家。
- SSE 同時解析 `delta.content`、`delta.reasoning`、`delta.reasoning_content`、`delta.reasoning_details`；reasoning 用原生 `<details>` 預設收起，不進 PDF。
- 背景執行：`arena-runner`／`provider-runner`／`debate-runner` 在頁面外，以 `historyId` 分離狀態；切換路由或對話只換畫面投影，只有停止按鈕或刪除紀錄會取消。`DebateOrchestrator` 用自己的 `DebateState`，不要讀全域狀態。
- 歷史：三頁串流中即時寫入 localStorage；新欄位（reasoning、`repeatCount`、`startingSide`）一律 optional 讀取，舊紀錄要能恢復。
- 裁判資料：競技場裁判逐模型收到系統提示詞、使用者問題與回答，候選內容明確當資料；裁判不顯示提示詞庫。

## 關鍵決策與踩雷
- 視覺：石墨配色，介面純灰階，顏色只給正反方（`pro`／`con`，已驗證色盲區分與對比）與狀態。`accent-text` 與 `ink` 同色，選取狀態不能只靠文字顏色。新元件用語意色名，不寫 `slate-*`、`dark:`、`primary-*`。
- 三個執行頁同一骨架：設定區（送出後收合）→ 結果 → 底部固定 `DropZone`（含強制暫停）。
- 安全：API Key 在 localStorage，模型回應一律不可信。曾實測 `<iframe srcdoc>` 讀得到金鑰；規則見 `MarkdownRenderer.tsx` 的 `SANITIZE_SCHEMA`。`rehype-highlight` 必須排在過濾之後，否則 class 被清掉。
- CSP 在 `vercel.json`（第二層防護）；開發伺服器不套用，驗證要用 production build 帶同樣 header。Playwright `wait_for_function` 字串寫法會被 CSP 擋，屬測試工具限制。
- `.md` 樣式只給畫面；PDF 走 `plain` 模式。改 Markdown 樣式不影響 PDF，但改 `MarkdownRenderer` 的標記結構要重驗 PDF。
- PDF 要實際渲染檢查（`pdftoppm`）；Canvas 與 PDF 座標方向不同，只看下載成功不夠。
- 驗證維持最小必要：一次 build、一次端到端 smoke、一次輸出檢查，不重跑已完成的舊流程。

## 驗證基準
- `npm test`（vitest，公式解析與 HTML 過濾；拿掉過濾或程式碼判斷會失敗）。
- `npm run build`（`tsc -b` + Vite production build）、`git diff --check`。
- UI 用 Playwright mock 串流驗證。

## 待辦
- 目前無未完成項目。

## 已知問題／刻意不處理
- 背景執行只保證同一分頁；重新整理或關閉分頁會中斷請求（已收到的部分仍在歷史）。
- 未實測：真實 OpenRouter 串流回應（模型清單 API 有實際呼叫）、實體手機、實體 iOS Safari、Acrobat 開 PDF。
- Browserslist 資料過期的建置警告屬非阻塞，未處理。
