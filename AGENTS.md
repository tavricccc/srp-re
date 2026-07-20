# AI 代理人開發指引

## 工作前提

0. Node.js 統一使用 24 LTS；不得為繞過依賴警告降到 Node 20 或降級主要 runtime 套件。
1. 修改依既有模組擴充，不另起平行實作。
2. 搜尋避開 `node_modules`、`dist`、`.vercel`、`.supabase` 等產物。
3. 不做 in-app browser preview；以 typecheck / lint / build 驗證。
4. 不覆蓋、不回復無關的工作樹變更。
5. Staging 用 `git add .`，不要逐檔 add。
6. 官方網站、完整文件與更新紀錄位於 `tavricccc/novae-website`，此 repo 只保留主程式必要入口。

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

- `src/styles/primitives.css` 與 `components/ui/` 是 UI 規範的單一來源；重複 dialog／empty／action 優先既有共用元件。
- 互動狀態單一來源；手機桌機同資料流、只切 layout。
- viewport 左右留白由 `AppShell`／`ViewportFrame` 統一負責；route view 只使用 `route-page` 組版，不自行加頁面級 `px-*`、`left-*`／`right-*` 或另一套 max-width。
- 卡片、控制項、浮動層只使用 control／card／floating 三階陰影 token。卡片與 list 用 `SurfacePanel`、`surface-*`、`list-surface(-row)`；按鈕用 `AppButton` 或既有 `button-*`；dropdown 用 `DropdownMenu`／`DropdownPanel` 與 `dropdown-item`；輸入組合用 `field`／`control-frame`。
- 相同結構若只差字串、icon、狀態、slot 或 callback，必須以 props／slots 共用；不得複製近似 button、dropdown、card、list、shadow、control 或 viewport 樣式。
- 新 UI primitive 必須有至少兩個合理使用點，加入 `primitives.css`／`components/ui`，同步更新 `structure.md`、架構測試與官方貢獻文件；不得在領域元件建立平行設計系統。
- 維持必要 `aria-label`／label／alt。

## 安全

- 不因重構改路由名、table／RPC／RLS、Edge action、Storage path、部署設定。
- 權限在 RLS／Edge；前端條件只負責顯示。
- 已部署 migration 不回改；只新增後續 migration。
- 通知、outbox、刪除工作等高風險不順手改。

## 驗證

一般前端／重構：`npm run verify:local`。
其中 `check:ui` 會拒絕舊 dropdown、任意陰影、手組卡片與自行管理 viewport gutter；不要跳過或以例外規避。
後端 action、權限、RPC、RLS、migration、worker：加跑 `npm run verify:integration`；Windows 入口會自動轉入 WSL，不手動維護第二套 Windows 流程。
大型變更／交付前：`npm run verify:all`。
新增 backend action 必須在 `tests/integration/` 加入有 assertion 的成功與拒絕案例；角色／scope 變更至少驗證 allowed、denied、跨 scope。`action-coverage.test.ts` 只作漏測防線，不得用無 assertion 呼叫敷衍。
失敗與 warning 能修就修，否則在報告說明。

# 注意:代碼追求簡潔乾淨 好維護 盡量不要打補丁式 要以可以復用為目標

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
