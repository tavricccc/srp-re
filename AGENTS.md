# AI 代理人開發指引

## 工作前提

1. 修改前先讀 `structure.md`，依既有模組擴充，不另起平行實作。
2. 搜尋避開 `node_modules`、`dist`、`.vercel`、`.supabase` 等產物。
3. 不做 in-app browser preview；以 typecheck / lint / build 驗證。
4. 不覆蓋、不回復無關的工作樹變更。
5. Staging 用 `git add .`，不要逐檔 add。
6. 官方網站、完整文件與更新紀錄位於 `tavricccc/novae-website`，此 repo 只保留主程式必要入口。
7. 資料流細節見[官方架構文件](https://tavricccc.github.io/novae-website/docs/architecture.html)。

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
