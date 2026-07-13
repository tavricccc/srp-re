# AI 代理人開發指引

## 工作前提

1. 修改前先讀 `structure.md`，依既有模組擴充，不另起平行實作。
2. 搜尋避開 `node_modules`、`dist`、`.vercel`、`.supabase` 等產物。
3. 不做 in-app browser preview；以 typecheck / lint / build 驗證。
4. 不覆蓋、不回復無關的工作樹變更。
5. Staging 用 `git add .`，不要逐檔 add。
6. `website/content/changelog.md` 只讀最前 20 行；禁止整份載入 context（檔案很大）。
7. 資料流細節見 `docs/architecture.md`。

## 架構邊界

| 層 | 職責 |
|---|---|
| `views/` | 路由頁組裝與頁面級狀態，不直接存取資料 |
| `components/` | 應用 UI 與事件轉發；流程進 composable |
| `components/ui/` | 無業務資料的共用 UI；**不** import service / session |
| `composables/` | Vue 狀態與流程；不重複純函式／正規化 |
| `lib/` | 無 Vue 相依的純工具 |
| `services/` | Edge Function / Supabase client 邊界；元件不直查表、不自組 action |
| `types/` | 跨模組型別；共通欄位先 base 再擴充 |
| `supabase/functions/_shared/` | Edge 共用 env、HTTP、auth、FCM、Notion、Cloudinary、schema |
| `supabase/functions/backendAction/` | 受控 action 入口與領域流程；entrypoint 只做 CORS／驗證／冪等／分派 |
| `supabase/functions/<fn>/` | 獨立 Function（登入同步、webhook、outbox、刪除、維護） |
| `supabase/migrations/` | schema / RLS / RPC；改 schema 時同步檢查 Edge 型別 |

## 拆分與共用

1. 相同 UI／流程出現兩次且差異僅 props／slots／callback → 抽共用。
2. 元件同時扛讀取、權限、流程與大模板 → 流程進 composable，再拆展示。
3. 單檔 ≳250 行檢查責任；≳400 行須能說明不拆理由。
4. 不為單一呼叫點的簡單片段建抽象。
5. 新增／刪除／搬移／拆分檔案時同步更新 `structure.md`。
6. 新流程接手後刪舊 API／props／CSS／轉場／註解，不留相容殘留。
7. 重構後用 `npm run check:unused`（或等效）確認無未使用宣告。

## Changelog

1. 每次有程式／文案／樣式／設定／後端行為變更，都要在 `website/content/changelog.md` 最前方新增一筆並更新累計次數。
2. 只寫使用者能感受到的結果；不寫過程、決策、工程細節。
3. 不暴露檔名、元件、service、action、排程、測試或部署細節。
4. 格式固定為 `## v版本｜產品向短標題`、空行、`YYYY-MM-DD HH:mm`、空行、改善項目清單；一項一改善點。
5. 允許動詞：新增、支援、改善、最佳化、調整、修正、提升、強化、統一、簡化、完善。
6. 禁用工程詞（重構、API、cache、service、composable…）與口語主觀詞（更順、更好用…）。
7. 台灣用語：最佳化、資訊、顯示、使用者、設定、登入、通知、權限、維護。
8. 維護性／內部變更用「提升維護穩定性」等包裝。
9. 版本遞增；日期與時間使用本地時間；不要手動建立 `id`。
10. 新增紀錄只用局部 patch 插入檔案開頭，不為了改一筆而讀取、重寫或格式化整份檔案。

## 命名與 TypeScript

- composable `useXxx`；元件 PascalCase；純函式描述輸入輸出。
- Props／emits／request／response 明確型別；邊界資料先 `unknown`，不用 `any` 穿透。
- 重複 union／label 放 types 或 constants；魔法數字用具名常數。

## Vue 與 UI

- 重複 dialog／empty／action 優先既有共用元件。
- 互動狀態單一來源；手機桌機同資料流、只切 layout。
- 優先 `style.css` 的 `panel`、`field`、`button-*`、`menu-item`、`popover-panel` 等；不另起近似系統。
- 維持必要 `aria-label`／label／alt。

## 安全

- 不因重構改路由名、table／RPC／RLS、Edge action、Storage path、部署設定。
- 權限在 RLS／Edge；前端條件只負責顯示。
- 已部署 migration 不回改；只新增後續 migration。
- 通知、outbox、刪除工作等高風險不順手改。

## 驗證

前端：`npm run typecheck` → `lint` → `build`（重構後加 `check:unused`）。
後端／migration／Edge 型別：`check:edge` + `test:architecture`。
失敗與 warning 能修就修，否則在報告說明。
