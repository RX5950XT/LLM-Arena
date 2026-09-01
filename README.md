# LLM Arena

LLM Arena 是一個在瀏覽器執行的模型比較工具。它使用 [OpenRouter](https://openrouter.ai) API，讓你把同一個問題送給多個模型、比較同一模型的不同供應商，或安排兩個模型進行多回合辯論。

API Key 只保存在目前瀏覽器的 `localStorage`，沒有後端代替你保管。這個專案適合個人或私有部署，不要把含有自己的 API Key 的畫面公開給其他人使用。

## 功能

### 模型競技場

路徑：`/#/`

- 用水平拉桿選擇 1–15 個模型。
- 可設定每個模型重複回答 1–5 次；每次回答獨立產生並分開顯示。
- 所有模型同時串流回答同一個問題，方便並排比較。
- 每個模型可單獨設定模型 ID、系統提示詞和推理模式。
- 可從設定頁的提示詞庫套用系統提示詞；按「統一提示詞」可把第一個模型的提示詞套用到全部模型。
- 可指定裁判模型。裁判會一起讀取每個模型的系統提示詞、使用者問題和每次模型回答，再依任務類型評估正確性、指令遵循、完整性、清晰度、實用性、創意和角色扮演品質，並計算每個模型的平均總分。
- 生成中可按「強制暫停」；輸入和已收到的內容會保留，之後可重新發送。

### OpenRouter 供應商比較

路徑：`/#/providers`

- 先輸入一個模型 ID，查詢 OpenRouter 回傳的可用 endpoint。
- 可選 1 個或多個供應商；每個供應商都會收到相同的系統提示詞、問題和附件。
- 使用 `provider.only` 鎖定實際供應商，避免回退到其他供應商。
- 顯示供應商的上下文長度與價格資料，並比較各自的回應和推理內容。
- 生成中會即時保存各供應商回應；切換到其他對話後，仍可回來查看已收到的內容。
- 生成中可強制暫停，保留目前結果並重新發送。

### AI 辯論

路徑：`/#/debate`

- 設定正方模型、反方模型、1–10 回合的辯論長度，以及由正方或反方先開始。
- 每回合從選定的起始方發言，再由另一方回應；模型會收到完整的前文。
- 辯論結束後，前三位專科裁判並行評估，最後由綜合裁判整合結果。
- 完成後可下載 PDF，內容依序包含正反方發言與四位裁判回應；PDF 支援 Markdown、GFM 表格與 KaTeX 數學公式，不匯出 reasoning。
- 生成中可強制暫停；保留議題和已完成的發言，之後可重新開始。

### 共用功能

- OpenRouter reasoning 可逐模型開啟，思考內容預設折疊，可手動展開。
- 支援 Markdown、GFM 表格、程式碼高亮和 KaTeX 數學公式。
- 輸入區可拖放或選取圖片與文字附件，單檔上限 20 MB。
- 設定頁可批量匯入 `.txt`／`.md` 系統提示詞，檔名會成為提示詞名稱。
- 三個執行頁都會把紀錄保存到瀏覽器；側邊欄可載入、刪除、匯出和匯入紀錄。
- 支援深色／淺色模式與手機版側邊欄。

## 快速開始

### 需求

- Node.js 18 或更新版本
- npm 8 或更新版本
- OpenRouter 帳號與 API Key

### 安裝

```bash
npm install
npm run dev
```

開發伺服器預設位於 `http://localhost:5173`。

### 建置與預覽

```bash
npm run build
npm run preview
```

`npm run build` 會先執行 TypeScript 檢查，再建立 Vite 生產檔案到 `dist/`。

## 使用方式

### 1. 設定 OpenRouter

開啟 `/#/settings`，填入：

| 設定 | 用途 |
| --- | --- |
| API URL | 預設為 `https://openrouter.ai/api/v1` |
| API Key | 從 [OpenRouter Keys](https://openrouter.ai/keys) 取得 |
| 話題命名模型 | 完成後替對話或辯論產生標題，預設為 `openrouter/free` |

設定會即時保存，不需要另外按儲存。

### 2. 管理模型清單

設定頁的「模型清單」可以新增或刪除常用模型。模型 ID 使用 OpenRouter 格式，例如：

```text
openai/gpt-4o
```

新環境目前預設包含：

```text
moonshotai/kimi-k2.6
deepseek/deepseek-v4-flash-0731
z-ai/glm-5.3
z-ai/glm-5.3-flash
qwen/qwen3.8-27b
openai/gpt-5.6-luna
```

### 3. 匯入系統提示詞

在設定頁的「系統提示詞」區塊批量拖入 `.txt` 或 `.md` 檔案，也可以按「選擇檔案」。每個檔案會變成一筆提示詞，檔名會去掉副檔名後作為名稱；重複或空白內容會略過。

提示詞庫目前提供給模型競技場和供應商比較。競技場的「統一提示詞」會直接複製模型 A 目前的內容，不會修改提示詞庫本身。

### 4. 發送與重新發送

三個執行頁在生成中都會把「發送」換成「強制暫停」：

1. 按下「強制暫停」會取消正在進行的串流請求。
2. 問題、議題、附件和已收到的部分回答會保留。
3. 按回「發送」會清除上一輪半成品，重新送出完整請求。

生成中的三種紀錄會即時保存；切換頁面或切換其他對話時，原本的請求仍會在背景跑到結束，回來就能看到最新結果。按「強制暫停」才會停止請求。頁面意外重新整理時，未完成的設定會暫存 15 分鐘，重新開啟後可以再次發送。

背景執行只保證在同一個瀏覽器分頁內；重新整理或關閉分頁會中斷網路請求，但已保存的部分結果仍會留下。

### 5. 管理對話紀錄

- 競技場、辯論和供應商比較各保留最多 50 筆紀錄。
- 生成中的紀錄也會出現在側邊欄。
- 可在設定頁匯出單一 JSON，或合併匯入其他 JSON。
- 圖片在歷史紀錄中只保留附件資訊，不保留 base64 內容，以減少儲存量。

## 路由

| 功能 | Hash 路徑 |
| --- | --- |
| 模型競技場 | `/#/` |
| AI 辯論 | `/#/debate` |
| 供應商比較 | `/#/providers` |
| 設定 | `/#/settings` |

專案使用 `HashRouter`，建置後可直接放到 Vercel、GitHub Pages 或其他靜態主機，不需要設定伺服器端路由轉址。

## 技術架構

| 類別 | 技術 |
| --- | --- |
| UI | React 18 + TypeScript |
| 建置 | Vite 5 |
| 樣式 | Tailwind CSS 3 |
| 狀態 | Zustand 5 |
| 路由 | React Router 6 + `HashRouter` |
| 文字 | `react-markdown`、`remark-gfm`、`rehype-highlight` |
| 數學公式 | KaTeX |
| API | OpenRouter Chat Completions + SSE |

### 主要資料流

```text
頁面輸入
   ├─ 模型競技場 ──> arena-runner ──> StreamingManager ──> 模型 × 重複次數的 OpenRouter streamChat
  │                                      └─> 可選裁判 streamChat
   ├─ 供應商比較 ──> provider-runner ──> StreamingManager ──> 每個 endpoint 一個 provider.only 請求
   └─ AI 辯論 ────> debate-runner ────> DebateOrchestrator ─> 起始方正反回合 ─> 裁判團 ─> PDF
```

所有串流都使用瀏覽器原生 `fetch`、`ReadableStream` 和 `AbortController`。取消時會中止請求；新一輪開始時會用執行編號擋住舊回應，避免污染新結果。

### 主要目錄

```text
src/
├── components/
│   ├── arena/          # 模型競技場
│   ├── debate/         # AI 辯論
│   ├── providers/      # 供應商比較
│   ├── settings/       # API、模型、提示詞和紀錄設定
│   ├── layout/         # 側邊欄與手機版主佈局
│   └── shared/         # ModelSlot、DropZone、Markdown、串流與推理顯示
├── services/           # OpenRouter、背景執行器、串流管理、辯論編排、PDF、附件處理
├── stores/             # Zustand 狀態與 localStorage 保存
├── types/              # API、模型、競技場、辯論和歷史型別
└── constants/          # 上傳限制與預設提示詞
```

## 開發指令

```bash
npm run dev      # 啟動開發伺服器
npm run build    # TypeScript 檢查與 Vite 生產建置
npm run preview  # 預覽 dist/
```

提交前至少執行：

```bash
npm run build
git diff --check
```

## 限制與安全提醒

- API Key 存在瀏覽器 `localStorage`，不要在共用電腦或公開前端中使用私人 Key。
- API 呼叫直接從瀏覽器送往 OpenRouter，實際可用模型、供應商和價格以 OpenRouter 當下回應為準。
- 長篇回答、附件和歷史紀錄會受到瀏覽器 `localStorage` 容量限制。
- 圖片是否能被模型理解，取決於所選模型和供應商是否支援視覺輸入。
