# LLM Arena — 大型語言模型競技場

一個基於瀏覽器的 LLM 評比與辯論平台，透過 [OpenRouter](https://openrouter.ai) API 同時呼叫多個大型語言模型，讓你對模型進行並排比較或設計結構化的 AI 辯論場景。

---

## 目錄

- [功能特色](#功能特色)
- [畫面截圖](#畫面截圖)
- [技術棧](#技術棧)
- [專案結構](#專案結構)
- [快速開始](#快速開始)
- [使用說明](#使用說明)
  - [設定頁面](#設定頁面)
  - [模型競技場](#模型競技場)
  - [AI 辯論](#ai-辯論)
- [架構設計](#架構設計)
  - [資料流](#資料流)
  - [串流處理](#串流處理)
  - [狀態管理](#狀態管理)
- [核心元件說明](#核心元件說明)
- [裁判評分系統](#裁判評分系統)
- [設定與配置](#設定與配置)
- [開發指南](#開發指南)

---

## 功能特色

### 模型競技場

- **2 至 4 個模型並排比較**：同時向多個模型發送同一個問題，即時查看差異
- **並行串流輸出**：所有模型同時開始回應，不需逐一等待
- **裁判自動評分**：由你指定的「裁判模型」對所有回應進行 5 維度評分（正確性、完整性、清晰度、實用性、創意性）
- **推理模式**：可為各模型單獨啟用 Extended Thinking（推理）模式
- **自訂系統提示詞**：每個模型插槽都可設定獨立的 System Prompt

### AI 辯論

- **正方 vs 反方**：兩個 AI 模型就你設定的議題展開多回合辯論
- **可設定回合數**（1–10 回合）
- **四位評判裁判**：辯論結束後自動啟動四位評判模型並行評估：
  1. **邏輯分析裁判**：論點邏輯嚴密性與推理有效性
  2. **論據品質裁判**：引用證據的可靠性與數據準確性
  3. **說服力裁判**：修辭技巧、語言說服力與情感訴求
  4. **綜合評判裁判**：整合三位評審意見，給出最終總評與勝負判定

### 通用功能

- **Markdown 渲染**：完整支援 GFM 語法、程式碼高亮、表格
- **LaTeX / KaTeX 數學公式**：支援行內與區塊數學公式渲染
- **多媒體附件**：拖放上傳圖片（PNG / JPEG / GIF / WebP）或文字檔案（TXT / MD / JSON / CSV），附件最大 20 MB
- **模型清單管理**：在設定頁面維護常用模型清單，輸入框可直接下拉選取
- **深色 / 淺色主題**：一鍵切換，設定持久化
- **本地持久化**：API Key、URL、模型清單均自動儲存至 localStorage

---

## 技術棧

| 類別     | 技術                                            |
| -------- | ----------------------------------------------- |
| 框架     | React 18 + TypeScript 5                         |
| 建置工具 | Vite 5                                          |
| 樣式     | Tailwind CSS 3（深色模式）                      |
| 狀態管理 | Zustand 5                                       |
| 路由     | React Router 6（HashRouter）                    |
| Markdown | react-markdown + remark-gfm + rehype-raw        |
| 數學公式 | KaTeX 0.16                                      |
| API      | OpenRouter Chat Completions（SSE 串流）         |
| 字型     | IBM Plex Sans（介面）+ JetBrains Mono（程式碼） |

---

## 專案結構

```
LLM_Arena/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.cjs
│
└── src/
    ├── main.tsx                     # 應用程式入口
    ├── App.tsx                      # 路由設定 + 初始化
    │
    ├── components/
    │   ├── layout/
    │   │   ├── MainLayout.tsx       # 主佈局（Sidebar + 內容區）
    │   │   └── Sidebar.tsx          # 側邊欄導航 + 主題切換
    │   ├── arena/
    │   │   └── ArenaPage.tsx        # 模型競技場頁面（220 行）
    │   ├── debate/
    │   │   └── DebatePage.tsx       # AI 辯論頁面（242 行）
    │   ├── settings/
    │   │   └── SettingsPage.tsx     # 設定頁面
    │   └── shared/
    │       ├── ModelSlot.tsx        # 模型插槽（輸入 + 下拉 + System Prompt）
    │       ├── DropZone.tsx         # 拖放上傳區域
    │       ├── StreamingText.tsx    # 節流串流文字顯示
    │       └── MarkdownRenderer.tsx # Markdown + KaTeX 渲染器
    │
    ├── services/
    │   ├── openrouter-client.ts     # OpenRouter API 客戶端（streamChat / chat）
    │   ├── streaming-manager.ts     # 多模型並行串流管理
    │   ├── debate-orchestrator.ts   # 辯論回合編排引擎
    │   └── file-handler.ts          # 檔案處理（base64 轉換、內容組裝）
    │
    ├── stores/
    │   ├── arena-store.ts           # 競技場狀態
    │   ├── debate-store.ts          # 辯論狀態
    │   ├── settings-store.ts        # 設定狀態（API 設定 + 模型清單）
    │   └── theme-store.ts           # 主題狀態
    │
    ├── types/
    │   ├── models.ts                # ChatMessage、Attachment、StreamCallbacks 等
    │   ├── arena.ts                 # ArenaSlot、ArenaState
    │   └── debate.ts                # DebateMessage、JudgeResult、DebateState
    │
    ├── constants/
    │   ├── config.ts                # 上傳限制、插槽數量上下限等
    │   └── default-prompts.ts       # 裁判與辯手的預設 System Prompts
    │
    └── styles/
        └── globals.css              # Tailwind 基礎樣式 + 自訂捲軸
```

---

## 快速開始

### 需求

- Node.js 18 以上
- npm 8 以上
- [OpenRouter](https://openrouter.ai) 帳號與 API Key

### 安裝與執行

```bash
# 1. 克隆專案
git clone <repository-url>
cd LLM_Arena

# 2. 安裝依賴
npm install

# 3. 啟動開發伺服器
npm run dev
```

開發伺服器預設於 `http://localhost:5173` 啟動。

### 生產建置

```bash
npm run build      # 輸出至 dist/
npm run preview    # 本地預覽生產版本
```

> **部署提示**：由於使用 HashRouter，`dist/` 目錄可以直接部署於任何靜態主機（GitHub Pages、Netlify、Vercel 等），不需特殊伺服器設定。

---

## 使用說明

### 設定頁面

在開始使用之前，請先至**設定頁面**（側邊欄底部齒輪圖示）完成基本設定。

#### OpenRouter API 設定

| 欄位    | 說明                                                                         |
| ------- | ---------------------------------------------------------------------------- |
| API URL | OpenRouter 端點，預設為 `https://openrouter.ai/api/v1`                     |
| API Key | 前往[openrouter.ai/keys](https://openrouter.ai/keys) 取得，格式為 `sk-or-...` |

所有設定均即時儲存，無需手動按下儲存按鈕。

#### 模型清單管理

在設定頁面右側的「模型清單」面板中，你可以維護一份常用模型的快速選取清單：

- 在輸入框中輸入模型 ID（格式：`提供商/模型名稱`），按 Enter 或點擊「新增」
- 滑鼠移至模型列表項目可顯示刪除按鈕
- 此清單會同步到競技場與辯論頁面的所有模型輸入框，可直接下拉選取

**預設模型清單：**

```
google/gemini-3-flash-preview
google/gemini-3.1-pro-preview
moonshotai/kimi-k2.5
z-ai/glm-5
minimax/minimax-m2.5
qwen/qwen3.5-397b-a17b
deepseek/deepseek-v3.2
```

> 可至 [openrouter.ai/models](https://openrouter.ai/models) 查詢所有可用模型 ID。

---

### 模型競技場

**路徑：** `/`（首頁）

#### 基本使用流程

1. **選擇模型數量**：點擊右上角的「2 / 3 / 4」按鈕，決定要同時比較幾個模型
2. **設定每個模型**：
   - 在輸入框輸入模型 ID，或從下拉清單中選取
   - 點擊「系統提示詞」可展開 System Prompt 編輯區
   - 點擊「推理」按鈕可啟用 Extended Thinking 模式（橙色表示已啟用）
3. **輸入問題**：在底部輸入框輸入你的問題
4. **上傳附件**（可選）：拖放圖片或文字檔案到輸入框下方區域
5. **發送**：點擊「發送」或按 `Ctrl + Enter`

所有模型將**同時開始串流回應**，可即時觀察各模型的輸出差異。

#### 裁判評分

在輸入區域下方可設定裁判模型：

- 輸入裁判模型 ID 並（可選）設定裁判 System Prompt
- 全部模型回應完成後，裁判會自動啟動並對所有回應進行評分
- 評分以 Markdown 格式輸出，預設包含 5 個維度（1–10 分）

#### 快捷鍵

| 快捷鍵           | 功能         |
| ---------------- | ------------ |
| `Ctrl + Enter` | 發送問題     |
| `Escape`       | 停止所有串流 |

---

### AI 辯論

**路徑：** `/debate`

#### 辯論設定

| 欄位       | 說明                                         |
| ---------- | -------------------------------------------- |
| 辯論議題   | 輸入辯論主題（如「人工智慧將取代人類工作」） |
| 回合數     | 1–10 回合，預設 3 回合                      |
| 正方模型   | 支持議題的 AI 模型                           |
| 反方模型   | 反對議題的 AI 模型                           |
| 系統提示詞 | 每方均有預設辯手 Prompt，可自訂修改          |

#### 辯論流程

1. 填寫議題、選擇正反方模型，設定回合數
2. 可上傳附件作為辯論背景資料
3. 點擊「開始辯論」啟動
4. 每回合依序：**正方發言 → 反方回應**，即時串流顯示
5. 所有回合結束後，四位評判模型**並行啟動**進行分析

#### 四位評判裁判

| 裁判         | 評估面向                                 |
| ------------ | ---------------------------------------- |
| 邏輯分析裁判 | 論點邏輯嚴密性、推理有效性、邏輯謬誤檢查 |
| 論據品質裁判 | 引用證據的可靠性、數據準確性、來源品質   |
| 說服力裁判   | 修辭技巧、語言說服力、情感訴求有效性     |
| 綜合評判裁判 | 整合三位評審意見，給出最終總評與勝負判定 |

評判結果以 2×2 網格排列顯示，每位評判均即時串流輸出分析報告。

---

## 架構設計

### 資料流

#### 競技場資料流

```
使用者輸入
    │
    ▼
ArenaPage.handleSend()
    │
    ├── 建立 StreamTask[]（每個啟用的模型插槽）
    │
    ▼
StreamingManager.streamAll(tasks)
    │
    ├── 並行啟動 Promise.allSettled()
    │   ├── Task A → OpenRouterClient.streamChat() → appendToken(A, token)
    │   ├── Task B → OpenRouterClient.streamChat() → appendToken(B, token)
    │   ├── Task C → ...
    │   └── Task D → ...
    │
    ▼（全部完成）
可選：OpenRouterClient.streamChat(judgeModel) → setJudgeResult(text)
```

#### 辯論資料流

```
使用者設定
    │
    ▼
DebateOrchestrator.startDebate()
    │
    ▼ 回合迴圈
    ├── speak('for')   → 正方串流 → appendStreamToken() → appendMessage()
    └── speak('against') → 反方串流 → appendStreamToken() → appendMessage()
    │
    ▼（辯論結束）
runJudges()
    ├── 並行啟動前三位評判（邏輯、論據、說服力）
    └── 三位完成後 → 啟動綜合評判裁判
```

### 串流處理

`OpenRouterClient.streamChat()` 使用 **Fetch API + ReadableStream** 實作 SSE 串流解析：

```
HTTP Response (SSE)
    │
    ▼
ReadableStream.getReader()
    │
    ▼ 逐塊讀取
TextDecoder.decode()
    │
    ▼ 按換行符分割
'data: {...}' → JSON.parse() → delta.content
    │
    ▼
callbacks.onToken(token)  ──→ Zustand store 更新
callbacks.onComplete()    ──→ 串流結束通知
callbacks.onError()       ──→ 錯誤處理
```

每個串流請求都綁定一個獨立的 `AbortController`，可按模型單獨取消或全部取消。

`StreamingText` 元件在串流期間對 Markdown + KaTeX 渲染節流（每 120ms 更新一次），串流結束後立即刷新，避免高頻渲染造成效能問題。

### 狀態管理

所有狀態透過 Zustand 管理，分為四個獨立 Store：

| Store              | 持久化       | 主要職責                     |
| ------------------ | ------------ | ---------------------------- |
| `settings-store` | localStorage | API URL、API Key、模型清單   |
| `theme-store`    | localStorage | 深色 / 淺色主題              |
| `arena-store`    | 記憶體       | 插槽配置、回應文字、裁判結果 |
| `debate-store`   | 記憶體       | 辯論配置、訊息歷史、評判結果 |

---

## 核心元件說明

### `OpenRouterClient`

位於 `src/services/openrouter-client.ts`

| 方法                                                            | 說明                  |
| --------------------------------------------------------------- | --------------------- |
| `streamChat(modelId, messages, callbacks, signal?, options?)` | SSE 串流對話          |
| `chat(modelId, messages, signal?, options?)`                  | 一次性非串流對話      |
| `testConnection()`                                            | 測試 API 連線是否正常 |

`options.reasoning` 可控制推理模式：

- `true` → 帶入 `{ reasoning: { effort: "high" } }`
- `false` → 帶入 `{ reasoning: { enabled: false } }`

### `StreamingManager`

位於 `src/services/streaming-manager.ts`

| 方法                 | 說明                 |
| -------------------- | -------------------- |
| `streamAll(tasks)` | 並行啟動所有串流任務 |
| `cancelAll()`      | 中止所有進行中的串流 |
| `cancelOne(id)`    | 中止指定任務         |

### `DebateOrchestrator`

位於 `src/services/debate-orchestrator.ts`

| 方法                    | 說明                            |
| ----------------------- | ------------------------------- |
| `startDebate(config)` | 啟動完整辯論流程（回合 + 評判） |
| `stop()`              | 停止辯論                        |

辯論內部會傳遞完整對話歷史給每一輪發言的模型，確保模型能根據前幾輪的辯論內容進行有效回應。

### `MarkdownRenderer`

位於 `src/components/shared/MarkdownRenderer.tsx`

包含以下特殊處理邏輯：

- **`fixTextBlocks()`**：修復部分模型在 `\text{}` 內使用 `$` 符號導致的解析錯誤
- **`joinSplitInlineMath()`**：合併被換行符分割的行內數學表達式
- **`preRenderMath()`**：直接使用 KaTeX 預渲染數學區塊，跳過 remark-math 的解析層

### `ModelSlot`

位於 `src/components/shared/ModelSlot.tsx`

使用 **React Portal** 渲染下拉清單至 `document.body`，避免被父容器的 `overflow: hidden` 裁切。透過 `getBoundingClientRect()` 動態計算位置，並監聽 scroll / resize 事件即時更新。

---

## 裁判評分系統

### 競技場裁判（預設 System Prompt）

請對以下各模型回應進行評比，依照以下 5 個維度各打 1-10 分，並給出總結評語：

| 維度   | 說明                       |
| ------ | -------------------------- |
| 正確性 | 內容是否正確、有無事實錯誤 |
| 完整性 | 是否充分回答問題的各面向   |
| 清晰度 | 表達是否清楚、結構是否良好 |
| 實用性 | 對使用者是否有實際幫助     |
| 創意性 | 是否提供獨到見解或解法     |

### 辯論評判裁判（預設 System Prompts）

所有裁判均接收完整的辯論紀錄（議題 + 所有回合的正反方發言），各自從專業視角進行評估。綜合評判裁判另外接收前三位評審的分析報告，做出最終裁定。

---

## 設定與配置

### 核心常數（`src/constants/config.ts`）

```typescript
DEFAULT_API_URL = 'https://openrouter.ai/api/v1'

SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
SUPPORTED_TEXT_TYPES  = ['text/plain', 'text/markdown', 'text/csv', 'application/json']
MAX_FILE_SIZE         = 20 * 1024 * 1024  // 20 MB

MIN_ARENA_SLOTS    = 2
MAX_ARENA_SLOTS    = 4
MIN_DEBATE_ROUNDS  = 1
MAX_DEBATE_ROUNDS  = 10
DEFAULT_DEBATE_ROUNDS = 3
```

### 主題色系

主色為**綠色系**（`primary-500: #22c55e`），用於互動元素、焦點環、按鈕等。

辯論介面額外使用：

- 正方：藍色（`blue-500`）
- 反方：紅色（`red-500`）

---

## 開發指南

### 本地開發

```bash
npm run dev      # 啟動開發伺服器（熱重載）
npm run build    # 型別檢查 + 生產建置
npm run preview  # 預覽生產版本
```

### 新增模型支援

OpenRouter 支援數百個模型，你只需在設定頁面的「模型清單」中新增模型 ID 即可使用。完整模型清單請參考：[openrouter.ai/models](https://openrouter.ai/models)

### 自訂裁判提示詞

裁判 System Prompt 支援在介面上即時編輯，無需修改程式碼。若要更改預設值，請修改 `src/constants/default-prompts.ts`。

### 技術限制

- **CORS**：OpenRouter 支援從瀏覽器直接呼叫，無需後端代理
- **API Key 安全性**：Key 儲存於 `localStorage`，僅適用於個人使用環境，請勿在公開服務上部署
- **串流協定**：使用標準 SSE（Server-Sent Events），依賴瀏覽器原生 `fetch` + `ReadableStream`

---
