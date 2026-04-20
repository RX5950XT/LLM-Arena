# LLM Arena

LLM 模型評比與辯論平台。用戶可以並行比較多個 LLM 的回應（競技場），或讓兩個 AI 進行多回合辯論（辯論）。

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
│   ├── debate/         # AI 辯論頁面
│   ├── settings/       # 設定頁面
│   └── shared/         # ModelSlot, MarkdownRenderer, StreamingText, DropZone
├── services/           # API 客戶端、串流管理、辯論編排、檔案處理、標題生成
├── stores/             # Zustand stores（arena, debate, history, settings, theme）
├── types/              # TypeScript 型別定義
└── constants/          # 設定常數、預設提示詞
```

## 核心功能

- **模型競技場**（`/`）：2–4 個模型並行串流回應，選配裁判 5 維度評分
- **AI 辯論**（`/debate`）：正反方多回合辯論，4 位評判裁判並行評審
- **設定**（`/settings`）：API Key、模型清單管理、歷史匯出/匯入

## 架構重點

- `OpenRouterClient`：Fetch + ReadableStream SSE 解析，支援 Extended Thinking；網路錯誤（TypeError）自動 retry 最多 2 次，每次間隔 1.5/3 秒
- `StreamingManager`：`Promise.allSettled` 並行多模型串流，AbortController 管理生命週期
- `DebateOrchestrator`：回合制辯論狀態機，每回合傳遞完整對話歷史
- 歷史紀錄：localStorage 持久化，各 50 筆上限，圖片附件替換為 placeholder 節省空間
- 主題：class-based dark mode（`document.documentElement.classList`）
- Portal 渲染：ModelSlot 下拉清單使用 `createPortal` 避免 overflow 裁切
- 中斷恢復：發送前將設定儲存於 localStorage（TTL 15 分鐘），重新整理後自動恢復並提示重新生成

## UI 功能

- **生成動畫**：`StreamingText` 在等待第一個 token 時顯示旋轉 spinner；生成中顯示 spinner + "生成中" 標籤；生成完成後 2.5 秒內顯示 "✓ 完成" 標籤
- **折疊回應**：競技場每個模型回應卡片可個別折疊/展開；辯論每回合訊息可折疊/展開

## RWD 設計

- `md`（768px）為主要斷點：手機版 Sidebar 為 Drawer 覆蓋層，桌面版為固定側欄
- 手機版顯示頂部 Header（漢堡按鈕 + Logo）
- 各頁面 Grid 在手機版降為單欄，桌面版恢復多欄

## 注意事項

- API Key 儲存於 localStorage，不上傳後端
- 使用 HashRouter（`/#/路徑`），適合靜態部署（Vercel、GitHub Pages）
- StreamingText 每 120ms 節流更新 Markdown 渲染以提升效能
- 中斷恢復 key：`arena-recovery-state`、`debate-recovery-state`（localStorage）
