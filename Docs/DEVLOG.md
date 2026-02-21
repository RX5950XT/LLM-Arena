# LLM Arena — 開發紀錄

本文件記錄 LLM Arena 的功能迭代歷程、設計決策與技術取捨。

---

## 目錄

- [v1.0 — 初版發布](#v10--初版發布)
- [v1.1 — 推理開關、API 重試、裁判修正](#v11--推理開關api-重試裁判修正)
- [v1.2 — 數學公式渲染修復](#v12--數學公式渲染修復)
- [v1.3 — 串流負載優化](#v13--串流負載優化)
- [v1.4 — 模型選單](#v14--模型選單)
- [v1.5 — 對話紀錄系統](#v15--對話紀錄系統)
- [v1.6 — 側邊欄 UI 重構](#v16--側邊欄-ui-重構)
- [v1.7 — 新對話功能修正](#v17--新對話功能修正)

---

## v1.0 — 初版發布

**commit:** `897d375`

### 功能

- 模型競技場：2–4 個模型並行 SSE 串流比較
- AI 辯論：正反方多回合辯論 + 四位評判裁判
- OpenRouter API 整合（`streamChat` + `chat`）
- Markdown + KaTeX 渲染
- 圖片 / 文字附件拖放上傳（最大 20 MB）
- 深色 / 淺色主題切換
- localStorage 持久化（API Key、URL、主題）

### 架構重點

**為何在 renderer 端直接呼叫 API？**

OpenRouter 對瀏覽器 CORS 友好，不需後端代理。在 renderer 端直接使用 `fetch` + `ReadableStream` 處理 SSE，避免了 IPC 瓶頸，串流延遲更低。

**為何選 HashRouter 而非 BrowserRouter？**

靜態部署（Vercel / GitHub Pages）不支援 HTML5 history API 的 server-side fallback，`HashRouter` 是最穩健的選擇，且不需 `vercel.json` 或 `_redirects` 設定。

**Zustand 分 Store 設計**

每個功能域獨立一個 Store，避免單一全域 Store 的耦合問題：
- `arena-store`、`debate-store` 為記憶體狀態（頁面刷新重置）
- `settings-store`、`theme-store` 手動同步至 `localStorage`

---

## v1.1 — 推理開關、API 重試、裁判修正

**commit:** `4285edb`

### 功能更新

- **推理模式開關**：每個模型插槽可單獨啟用 Extended Thinking，發送請求時帶入 `reasoning: { effort: "high" }` 或 `reasoning: { enabled: false }`
- **API 呼叫錯誤重試**：網路短暫失敗時自動重試（最多 3 次，指數退避）
- **裁判方式修正**：競技場裁判改為在所有模型串流結束後才啟動，避免裁判提前讀到不完整回應

### 技術決策

**推理模式 API 格式**

OpenRouter 的 reasoning 參數格式為：
```json
{ "reasoning": { "effort": "high" } }
```
關閉時需明確傳入 `{ "reasoning": { "enabled": false } }` 以覆蓋平台預設值。

---

## v1.2 — 數學公式渲染修復

**commit:** `491a4fc`

### 問題描述

部分模型輸出的 LaTeX 語法導致 KaTeX 解析失敗：

1. `\text{A $x$ B}` 中的 `$` 被 remark-math 誤判為行內數學分隔符
2. 行內公式被換行符拆成 `$...\n...$` 導致未能識別

### 解決方案

在 `MarkdownRenderer.tsx` 的 Markdown 預處理階段新增三道修正：

- **`fixTextBlocks()`**：使用正規表達式將 `\text{...}` 內的 `$` 替換為 Unicode 全形 `＄`，避免干擾解析
- **`joinSplitInlineMath()`**：合併跨行的行內公式 `$...\n...$` → `$... ...$`
- **`preRenderMath()`**：對 `$$...$$` 區塊直接呼叫 `katex.renderToString()` 並注入 HTML，跳過 remark-math 層

---

## v1.3 — 串流負載優化

**commit:** `2d7f6ba`

### 問題描述

4 個模型同時串流時，每個 token 觸發一次 React 重新渲染，造成 UI 卡頓。

### 解決方案

`StreamingText` 元件中加入節流機制：

```typescript
// 串流期間：每 120ms 才重新渲染一次 Markdown
// 串流結束：立即刷新，確保最終輸出正確
```

使用 `useRef` 儲存最新文字，`setInterval` 定時更新 state，串流結束時 `clearInterval` 並強制刷新。

### 效果

- 串流期間 React 重渲頻率從每個 token 降至每 120ms
- 串流結束後無延遲，使用者體驗不受影響

---

## v1.4 — 模型選單

**commit:** `15864f5`

### 功能

在設定頁面新增「模型清單」管理面板：

- 使用者可自行新增 / 刪除常用模型 ID
- 儲存至 `settings-store`（localStorage 持久化）
- 競技場與辯論的所有模型輸入框顯示下拉選單，選項來自此清單

### 實作重點

**`ModelSlot` 下拉選單的 Portal 定位**

模型輸入框位於多層 `overflow: hidden` 容器內，一般的 `position: absolute` 下拉會被裁切。改用 `ReactDOM.createPortal()` 將下拉渲染至 `document.body`，再透過 `getBoundingClientRect()` 取得輸入框的視窗座標動態定位。同時監聽 `scroll` 與 `resize` 事件，確保捲動後位置準確。

---

## v1.5 — 對話紀錄系統

### 需求分析

使用者希望在無後端的純前端部署環境（Vercel 靜態頁面）中保存對話紀錄，因此採用 `localStorage` 作為唯一儲存層。

### 設計決策

**1. 分開 vs 合併儲存**

競技場與辯論的資料結構差異較大，合併存放會使型別複雜、查詢困難，因此使用兩個獨立的 localStorage key：
- `llm-arena-history-arena`
- `llm-arena-history-debate`

**2. 圖片附件的儲存策略**

base64 圖片可能達數 MB，全部儲存會很快耗盡 localStorage（通常 5–10 MB 上限）。

決策：**圖片僅保留 metadata（檔名、類型、大小），content 清空，`isImagePlaceholder: true`**。

還原時，圖片附件不會出現在輸入框（已被過濾掉），使用者若需要再次使用相同圖片需重新上傳，此為可接受的取捨。

**3. 自動儲存時機**

在所有串流（含裁判）完成後觸發，避免儲存到不完整的紀錄。實作上使用 `void (async () => {...})()` 的 IIFE 背景執行，不阻塞 `setIsSending(false)` 的 UI 解鎖。

**4. 標題生成**

使用 Vision Language Model（預設 `qwen/qwen3-vl-8b-instruct`）自動生成摘要標題，使標題能反映圖片內容。呼叫方式為非串流的 `chat()`，以免阻塞主流程。失敗時截取輸入文字前 40 字作為 fallback。

**5. 載入後再次發送的行為**

兩個選項：
- A. 建立新紀錄
- B. 更新原紀錄

選擇 B（更新原紀錄）。理由：使用者載入歷史是為了在同一個問題上繼續調整，建立新紀錄反而造成重複。`history-store` 以 `activeArenaId` / `activeDebateId` 追蹤當前紀錄 ID，`saveArena` / `saveDebate` 根據此 ID 決定 update 或 insert。

**6. 上限設計**

每種類型上限 50 筆，超出時移除 `updatedAt` 最舊的紀錄（`pruneToMax()`）。

**7. 匯出 / 匯入格式**

```json
{
  "version": 1,
  "exportedAt": 1700000000000,
  "arena": [...],
  "debate": [...]
}
```

合併匯入採去重（以 `id` 為 key），不覆蓋現有紀錄，再套用上限剪裁。

### 新增檔案

| 檔案 | 說明 |
|------|------|
| `src/types/history.ts` | `StoredAttachment`、`ArenaHistoryEntry`、`DebateHistoryEntry`、`HistoryExport` 型別定義 |
| `src/stores/history-store.ts` | Zustand store，管理紀錄的 CRUD、匯出、匯入 |
| `src/services/title-generator.ts` | 呼叫 Vision LLM 生成標題 |

### 修改檔案

| 檔案 | 修改內容 |
|------|---------|
| `src/stores/settings-store.ts` | 新增 `titleModelId` 欄位（預設 `qwen/qwen3-vl-8b-instruct`） |
| `src/stores/arena-store.ts` | 新增 `restoreFromHistory(entry)` action |
| `src/stores/debate-store.ts` | 新增 `restoreFromHistory(entry)` action |
| `src/App.tsx` | 啟動時呼叫 `loadHistory()` |
| `src/components/layout/Sidebar.tsx` | 加入歷史紀錄面板 UI |
| `src/components/settings/SettingsPage.tsx` | 新增「話題命名模型」輸入框 + 匯出 / 匯入按鈕 |
| `src/components/arena/ArenaPage.tsx` | 對話完成後背景觸發 `saveArena()` |
| `src/components/debate/DebatePage.tsx` | 對話完成後背景觸發 `saveDebate()` |

---

## v1.6 — 側邊欄 UI 重構

### 問題

歷史紀錄初版採用「點擊時鐘圖示 → 從側邊彈出浮動面板」的設計，使用者反映不直覺：

1. 浮動面板在主內容區旁邊獨立出現，割裂感強
2. 需要精準點擊小圖示才能觸發

### 迭代過程

**第一版**：時鐘圖示 → 右側浮動面板（`position: absolute; left: 100%`）

問題：視覺上不符合「側邊欄展開」的直覺，較像 tooltip / popover。

**第二版**：箭頭按鈕 → inline accordion 展開，歷史清單插入導覽列中

問題：箭頭按鈕獨立於 NavLink 之外，點擊區域小，使用者需精準對準。

**第三版（最終）**：箭頭整合進 NavLink，點擊整條導覽項目均可觸發展開 / 收合

技術細節：
- 箭頭改為純 `<span>` 裝飾元素，移除獨立 `<button>` 避免事件衝突
- NavLink 的 `onClick` 加上 `toggleExpanded(type)` 呼叫
- 箭頭使用 `rotate-180` Tailwind class + `transition-transform duration-200` 做旋轉動畫，展開與收合視覺一致

### 最終設計要點

| 項目 | 說明 |
|------|------|
| 觸發區域 | 整條導覽列（同時執行頁面導航 + 展開切換） |
| 箭頭狀態 | 收合 ↓ / 展開 ↑（rotate-180 動畫） |
| 展開狀態顏色 | 箭頭不變色，避免與 NavLink active 狀態混淆 |
| 歷史項目 | 左側指示線（active 為綠色，其他為灰色）+ 標題 + 相對時間 |
| 「+ 新對話」按鈕 | 與導覽列對齊寬度，清除 activeId 並導航至對應頁面 |
| nav 區域 | 加上 `overflow-y-auto` 支援歷史紀錄較多時捲動 |
| 設定分隔 | 競技場 / 辯論與設定之間加細分隔線，區分功能群組 |

---

## v1.7 — 新對話功能修正

### 問題描述

側邊欄的「+ 新對話」按鈕有兩個問題：

1. **畫面未清空**：按下後只清除了 `activeArenaId` / `activeDebateId`，未呼叫 store reset，導致上一筆歷史紀錄的回應內容、輸入文字、附件仍殘留在畫面上。
2. **裁判模型 ID 未清空**：競技場的 `judgeModelId` 欄位在「新對話」後仍保留前一筆紀錄的值。

### 解決方案

**新增 `resetAll()` action（`arena-store.ts`）**

原有的 `resetResponses()` 只清除各插槽的回應文字，不清 `userInput`、`attachments`、`judgeModelId` 等欄位。新增 `resetAll()` 做完整重置：

```typescript
resetAll: () => {
  set((state) => ({
    slots: Array.from({ length: state.slotCount }, (_, i) => createSlot(i)),
    userInput: '',
    attachments: [],
    judgeModelId: '',
    judgeSystemPrompt: ARENA_JUDGE_DEFAULT_PROMPT,
    judgeResult: null,
    isJudging: false,
    isSending: false
  }))
}
```

保留 `slotCount` 不重置（使用者習慣的模型數量）。

**更新 `handleNewSession()`（`Sidebar.tsx`）**

```typescript
const handleNewSession = (): void => {
  if (type === 'arena') {
    arenaStore.resetAll()          // 完整清空所有欄位
    historyStore.setActiveArenaId(null)
    navigate('/')
  } else {
    debateStore.reset()            // debate-store 原有的完整重置
    historyStore.setActiveDebateId(null)
    navigate('/debate')
  }
}
```

辯論端原本已有 `reset()` 可完整重置，直接沿用即可。
