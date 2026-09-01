# LLM Arena

LLM 模型評比與辯論平台。用戶可以並行比較多個 LLM 的回應（競技場）、比較同模型的 OpenRouter 供應商，或讓兩個 AI 進行多回合辯論（辯論）。

## 技術棧

| 分類 | 技術 |
|------|------|
| 框架 | React 18 + TypeScript |
| 建置工具 | Vite 5 |
| 路由 | React Router 6（HashRouter） |
| 狀態管理 | Zustand 5 |
| 樣式 | Tailwind CSS 3 |
| Markdown | react-markdown + rehype-highlight + KaTeX |
| 部署 | Vercel |

## 開發指令

```bash
npm run dev      # 啟動開發伺服器（http://localhost:5173）
npm run build    # 生產建置（tsc -b && vite build）
npm run preview  # 預覽生產版本
```

## 目錄結構

```
src/
├── components/
│   ├── layout/         # MainLayout（含手機版 Sidebar 狀態）、Sidebar（手機 Drawer）
│   ├── arena/          # 模型競技場頁面
│   ├── providers/      # OpenRouter 供應商比較頁面
│   ├── debate/         # AI 辯論頁面
│   ├── settings/       # 設定頁面
│   └── shared/         # ModelSlot, MarkdownRenderer, StreamingText, DropZone
├── services/           # API 客戶端、串流管理、辯論編排、檔案處理、標題生成
├── stores/             # Zustand stores（arena, debate, history, settings, theme）
├── types/              # TypeScript 型別定義
└── constants/          # 設定常數、預設提示詞
```

## 核心功能

- **模型競技場**（`/`）：1–15 個模型並行串流回應，每個模型可重複回答 1–5 次，選配裁判比較每次回答並計算平均總分
- **供應商比較**（`/providers`）：查詢同一模型的 endpoints，勾選 1 個以上供應商並行比較回應
- **AI 辯論**（`/debate`）：可選正方或反方先開始的多回合辯論，前三位裁判並行、最後由綜合裁判評審，完成後可下載依序整理的 PDF
- **設定**（`/settings`）：API Key、模型清單、系統提示詞批量匯入、歷史匯出/匯入

## 架構重點

- `OpenRouterClient`：Fetch + ReadableStream SSE 解析，支援 Extended Thinking、reasoning token 與 `provider.only`；網路錯誤（TypeError）自動 retry 最多 2 次，每次間隔 1.5/3 秒
- `StreamingManager`：`Promise.allSettled` 並行多模型串流，AbortController 管理單次執行；`arena-runner`／`provider-runner`／`debate-runner` 放在頁面外，切換對話後仍會繼續
- `DebateOrchestrator`：回合制辯論狀態機，依 `startingSide` 傳遞完整對話歷史；`stop()` 可中止流程並讓頁面回到可重送狀態
- `debate-pdf`：不新增依賴，使用既有 Markdown/KaTeX renderer 將辯論訊息與裁判回應排版為 A4 PDF，排除 reasoning
- `settings-store`：保存模型清單與系統提示詞庫；`.txt`／`.md` 檔名作為提示詞名稱
- 歷史紀錄：三個執行頁都在串流中即時寫入 localStorage，各 50 筆上限；圖片附件替換為 placeholder 節省空間
- 主題：class-based dark mode（`document.documentElement.classList`）
- Portal 渲染：ModelSlot 下拉清單使用 `createPortal` 避免 overflow 裁切
- 中斷恢復：發送前將設定儲存於 localStorage（TTL 15 分鐘），重新整理後自動恢復並提示重新生成；強制暫停後保留輸入，可重新發送

## UI 功能

- **生成動畫**：`StreamingText` 在等待第一個 token 時顯示旋轉 spinner；生成中顯示 spinner + "生成中" 標籤；生成完成後 2.5 秒內顯示 "✓ 完成" 標籤
- **折疊回應**：競技場每個模型回應卡片可個別折疊/展開；辯論每回合訊息可折疊/展開
- **折疊推理**：OpenRouter 回傳 reasoning 時，`ReasoningDisclosure` 以原生 `<details>` 預設收起思考內容
- **系統提示詞庫**：設定頁可批量拖入 `.txt`／`.md`，競技場與供應商比較的模型設定可直接套用
- **統一提示詞**：競技場可把模型 A 的系統提示詞一鍵套用到全部模型；裁判模型不顯示提示詞庫
- **重複回答與平均評分**：競技場每個模型可獨立嘗試同一問題 1–5 次，裁判逐次評分後依平均總分排名
- **背景執行與強制暫停**：三種執行都在同一分頁背景完成；`DropZone` 停止按鈕才會取消串流並阻擋舊回應污染新一輪
- **辯論匯出**：辯論頁可選起始方；完成後下載支援 Markdown、表格和數學公式且不含 reasoning 的 PDF

## RWD 設計

- `md`（768px）為主要斷點：手機版 Sidebar 為 Drawer 覆蓋層，桌面版為固定側欄
- 手機版顯示頂部 Header（漢堡按鈕 + Logo）
- 各頁面 Grid 在手機版降為單欄，桌面版恢復多欄
- 供應商比較頁在手機版將設定、供應商清單與回應卡片改為單欄，清單可獨立滑動
- 設定頁的提示詞匯入區與提示詞清單在手機版維持單欄、可垂直閱讀

## 注意事項

- API Key 儲存於 localStorage，不上傳後端
- 使用 HashRouter（`/#/路徑`），適合靜態部署（Vercel、GitHub Pages）
- StreamingText 每 120ms 節流更新 Markdown 渲染以提升效能
- 中斷恢復 key：`arena-recovery-state`、`debate-recovery-state`（localStorage）
