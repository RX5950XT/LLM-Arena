# 工作計畫

## 本次需求：新增 LLM Arena 品牌 logo

- [x] 產生適合 favicon 與 20–24px header 的簡潔幾何 logo
- [x] 將 logo 接到 Sidebar、手機版 Header 與 `index.html` favicon
- [x] 執行 build 與瀏覽器資產讀取驗證

## 本次需求回顧

- 使用 `imagegen` 產生透明背景的幾何 logo，複用於桌面 Sidebar、手機版 Header 與 favicon。
- `npm run build` 通過（exit code `0`）；`git diff --check` 通過。
- Playwright 桌面／手機截圖可見 logo；兩個圖片元素均載入完成（natural size `1254×1254`），favicon URL 為 `/llm-arena-logo.png`。

# 本次需求：程式檢查、清理、提交與部署

- [x] 檢查目前程式與 Git 變更，確認沒有明顯錯誤或敏感資料
- [x] 清理已確認的產物／垃圾，補齊必要的 Git 排除規則
- [x] 以一次 build 和一次 diff／狀態檢查驗收
- [x] 提交並推送到 `origin/main`
- [x] 查看部署狀態並記錄結果

## 本次需求回顧

- 檢查 staged 清單與密鑰掃描，未提交 `dist`、`node_modules`、`.vercel`、`.vscode` 或測試輸出；移除追蹤中的 `tsconfig.tsbuildinfo`，並補上產物排除規則。
- `npm run build` 通過，exit code `0`；`git diff --cached --check` 通過。
- commit `68f6630` 已推送至 `origin/main`；Vercel Production 部署 `https://llm-arena-dr85og7mq-rx5950xts-projects.vercel.app` 狀態為 `Ready`。
- 保留既有 Browserslist 資料過期與 bundle 超過 500 kB 的非阻塞警告，這次不為警告擴大修改範圍。

## 本次需求：切換對話後仍在背景完成

- [x] 將競技場串流與裁判流程移到頁面外的執行狀態
- [x] 將辯論 orchestrator 改為獨立狀態，切換對話不再中止
- [x] 將供應商比較串流移到頁面外，返回時同步即時結果
- [x] 只驗證一次 build 與一次最小切換中途／完成 smoke

## 本次需求回顧

- 三種模式以 `historyId` 在頁面外保存背景執行狀態；切換路由或歷史紀錄只切換畫面投影，停止按鈕與刪除紀錄才會取消執行。
- `DebateOrchestrator` 改為使用自己的 `DebateState`，避免載入其他對話後讀錯全域狀態；三種串流都持續寫入指定歷史。
- 驗證：`npm run build` exit code `0`；Playwright 延遲 mock 下，供應商、競技場、辯論離開頁面後都能完成，分別讀回完成回應、完成回應、3 回合 6 則訊息。
- 已知範圍：只保證同一瀏覽器分頁；重新整理或關閉分頁會中斷網路請求，但已保存部分仍在歷史中。

## 本次需求：歷史保存與 PDF 匯出

- [x] 讓供應商比較使用歷史紀錄，且串流中即時保存
- [x] 切換對話後可恢復執行中的供應商／其他對話畫面
- [x] 競技場模型數量下限改為 1
- [x] PDF 排除 reasoning，並支援 Markdown、數學公式與表格
- [x] 執行 build、資料流測試與瀏覽器／PDF 實際驗證

## 本次需求回顧

- 三個執行頁共用 `history-store` 保存完整設定、串流內容與目前狀態；側邊欄新增供應商歷史紀錄。
- 切換對話時取消舊請求並保存已收到內容，返回時由歷史紀錄恢復畫面。
- 競技場下限改為 1；辯論 PDF 重用既有 Markdown/KaTeX renderer，reasoning 只留在畫面與歷史，不放進 PDF。
- 驗證：`npm run build`、`git diff --check`、Playwright mock 串流／切換／PDF 下載與 `pdftoppm` 視覺檢查通過。

- [x] 追蹤 OpenRouter reasoning 與 provider routing 的資料流
- [x] 保存並顯示 reasoning，讓思考內容可折疊
- [x] 新增 OpenRouter 供應商查詢與多供應商比較頁
- [x] 加入側邊欄路由與手機版排版
- [x] 執行 TypeScript/build 與瀏覽器互動驗證

## 回顧

- 用既有 `OpenRouterClient` 與 `StreamingManager` 擴充，沒有新增依賴。
- 使用 native `<details>` 收起 reasoning，並以 `provider.only` 確保比較結果不會被 fallback 到別的供應商。
- UI 驗證使用 mock API；真實供應商清單與回應仍取決於使用者的 OpenRouter API Key 和 endpoint 可用性。

## 系統提示詞匯入

- [x] 擴充 settings store，保存可批量匯入的系統提示詞
- [x] 在設定頁加入 `.txt`／`.md` 多檔拖放匯入、清單與刪除
- [x] 讓模型競技場與供應商比較可從提示詞庫套用系統提示詞
- [x] 執行 build 與瀏覽器互動驗證

## 本次功能回顧

- 每個文字檔以檔名建立一筆提示詞，保存到既有 `llm-arena-settings` localStorage。
- `ModelSlot` 只在競技場與供應商比較開啟提示詞庫選單，保留辯論頁原本行為。
- build 與實際瀏覽器拖放、套用流程均通過。

## 提示詞庫可見性修正

- [x] 沒有已儲存提示詞時仍顯示提示詞庫
- [x] 提供前往設定匯入的入口
- [x] 執行 build 與瀏覽器畫面驗證

## 本次修正回顧

- 之前只有在提示詞已存在時才渲染選單，空狀態讓使用者誤以為功能不存在；現在保留 disabled 選單與設定連結。

## 本次需求：競技場與供應商選擇

- [x] 供應商比較允許只選 1 家供應商
- [x] 競技場模型數量改為 2–15 的水平拉桿
- [x] 競技場加入以第一個模型提示詞統一套用的按鈕
- [x] 裁判模型移除提示詞庫選單
- [x] 執行 build 與瀏覽器互動驗證

## 本次需求回顧

- 供應商比較保留至少 1 家的必要條件，移除至少 2 家限制。
- 模型數量控制改用原生 range input，最大值為 15。
- 統一提示詞直接複製第一個模型目前的系統提示詞；不另建提示詞選擇狀態。

## 本次需求：強制暫停與競技場裁判

- [x] 三個頁面加入可中止串流、保留輸入並可重新發送的強制暫停按鈕
- [x] 競技場裁判收到每個比較模型的系統提示詞、問題與回答
- [x] 強化競技場裁判預設提示詞，涵蓋一般任務與角色扮演品質
- [x] 執行 TypeScript/build 驗證

## 本次需求回顧

- 使用共用 `DropZone` 顯示強制暫停，停止時取消現有請求並保留輸入；以執行編號避免舊請求污染重新發送的結果。
- 競技場裁判的比較資料改為逐模型列出系統提示詞、同一問題與回答，並明確把候選內容視為資料。
- 裁判預設提示詞改成依任務調整標準，加入角色扮演、創意、實用性與安全性評估。

## 本次文件整理

- [x] 重寫 README，反映目前功能、操作方式與實際架構
- [x] 更新 CLAUDE.md 與 CONTEXT.md 的過時限制和文件連結
- [x] 執行文件內容搜尋與 build 驗證

## 本次文件整理回顧

- README 已改為目前功能說明，包含 2–15 模型、1+ 供應商、提示詞庫、裁判資料、強制暫停和手機版路由。
- 移除已刪除的 `Docs/DEVLOG.md` 文件引用，不新增替代日誌檔案。
- `npm run build`、`git diff --check` 與文件一致性檢查均通過。

## 本次需求：競技場重複回答與平均評分

- [x] 增加 1–5 次重複回答設定並保存於競技場狀態／歷史
- [x] 讓每個模型獨立產生多次回答，並可中止後重新發送
- [x] 讓裁判逐次評分並計算每個模型的平均總分
- [x] 更新結果顯示、文件與交接紀錄
- [x] 執行 build、diff 檢查與最小資料流驗證

## 本次需求回顧

- 使用既有 `StreamingManager` 建立「模型 × 重複次數」的獨立串流任務；每個回答以 `ArenaAttempt` 保存，取消與舊回應防護沿用現有 `AbortController`。
- 歷史新格式保存每次回答與重複次數，恢復時仍支援既有單次回答欄位。
- 裁判收到所有嘗試後，依預設提示詞逐次評分並計算平均總分；自訂裁判提示詞仍可使用。

## 本次需求：辯論起始方、裁判排版與 PDF 匯出

- [x] 新增起始方設定，套用至辯論流程、恢復資料與歷史紀錄
- [x] 將三位專科裁判並排，最終裁判放在下一列
- [x] 完成辯論後可依辯論訊息順序與裁判順序下載 PDF
- [x] 執行 build、diff 檢查與 PDF 產出／渲染驗證

## 本次需求回顧

- `startingSide` 由設定頁面狀態一路傳到 `DebateOrchestrator`，並向下相容舊的恢復資料與歷史紀錄。
- 裁判區改用三欄 Grid，綜合裁判跨欄放在下一列。
- `debate-pdf` 使用瀏覽器原生 Canvas 與 Blob 產生 A4 PDF，保留訊息陣列順序，再接續輸出四位裁判。
- 驗證：`npm run build` 通過；Playwright mock 首兩次請求為反方、正方；PDF 下載成功，`pdfinfo` 顯示短內容 1 頁／長內容 13 頁 A4，`pdftoppm` 渲染無錯誤。
