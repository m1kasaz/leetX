# Notion 导出功能设计

日期：2026-08-16
状态：已获用户批准设计，待实现

## 背景

leetX 是 WXT 浏览器扩展，在 LeetCode/洛谷提交后捕获代码并支持 AI 分析。分析结果（`SavedAnalysis`）目前只能在工作台查看。用户希望把分析结果一键导入自己的 Notion「算法笔记」页面，格式模仿其现有笔记的**心得速记条目**风格。

用户笔记风格（参考页面 https://app.notion.com/p/3b068cd6eb7780c58d2efce8d3f668d4）：

- 条目以题目书签（bookmark）开头
- 2~4 条浓缩要点（思路、状态语义、易错点），中文为主，术语保留英文
- 附关键代码块（Java/Python），可带中文行内注释
- 条目之间用分割线隔开

## 已确认的决策

1. **接入方式**：Notion Internal Integration Token。用户在 notion.so/integrations 自行创建 integration 并把目标页面分享给它，token 填入扩展设置。
2. **导入目标**：追加到设置中指定的固定页面底部，条目间用 divider 隔开。
3. **笔记风格**：心得速记条目（书签 + 要点列表 + 代码块 + 分割线）。

## 架构

### 1. 设置链路（复刻现有 AI 设置模式）

- 新增 `src/notion/settings.ts`：zod schema `notionSettingsSchema = { token: string, pageId: string }`，存 `chrome.storage.local`，key `leetx:notionSettings`。
  - `pageId` 从用户粘贴的 Notion 页面 URL 中提取（32 位 hex，容忍连字符），提供 `extractPageId(input: string): string | null` 纯函数。
- `entrypoints/app/components/SettingsModal.tsx` 增加「Notion」区：
  - Integration Token 输入框（password 类型）
  - 目标页面 URL 输入框（保存时提取 page id，无法提取则报错）
  - 「测试连接」按钮：调 `GET /v1/users/me` 验证 token，再调 `GET /v1/pages/{pageId}` 验证页面已分享给 integration
- 消息协议 `src/messaging/messages.ts` 的 `extensionRequestSchema` 增加：
  - `leetx/get-notion-settings`（返回完整 token，以便设置页回填编辑；token 只存本机 `storage.local`，仅本扩展页面可读）
  - `leetx/save-notion-settings`（payload 为 settings 对象）
  - `leetx/test-notion-connection`（payload 为待测试的 settings，不落库）
  - `leetx/export-notion`（payload `{ analysisId: string }`）
- `entrypoints/background.ts`：`PrivilegedMessage` union 加对应类型，`privileged()` 加分支，沿用现有 `sender.id === chrome.runtime.id` 特权校验。

### 2. Notion 客户端（background 侧）

新增 `src/notion/client.ts`，裸 `fetch` 封装（不引入 SDK，风格参照 `src/ai/provider.ts`）：

- `testConnection(token): Promise<void>` — `GET /v1/users/me`
- `getPage(token, pageId): Promise<{ title: string }>` — 校验页面可达
- `appendBlocks(token, pageId, blocks): Promise<void>` — `PATCH /v1/blocks/{pageId}/children`
- 统一请求头：`Authorization: Bearer <token>`、`Notion-Version: 2022-06-28`、`Content-Type: application/json`
- 错误分类：`401` → token 无效；`403/404` → 页面未分享给 integration；`429` → 限流（简单重试一次，间隔 1s）；其他 → 透传状态码和 body 摘要
- 权限：首次调用前通过 `chrome.permissions.request({ origins: ['https://api.notion.com/*'] })` 动态授权（复用 `App.tsx` 现有模式；`wxt.config.ts` 的 `optional_host_permissions` 已覆盖，无需改 manifest）

### 3. 风格映射 `src/notion/format.ts`（纯函数，核心）

输入：`SavedAnalysis` + 可选的 `{ title?: string; canonicalUrl?: string }`（导出时 background 从 captures 按 `problemKey` 查 `canonicalUrl`/`title` 传入；查不到则省略 bookmark，标题用 `problemKey`）。

输出：Notion block 对象数组（手写 JSON，类型用轻量本地 interface，不引入 `@notionhq/client` 的类型）。

`content.kind === 'json'` 时映射（字段缺失时跳过对应块）：

| 顺序 | Notion block | 来源 |
|---|---|---|
| 1 | `bookmark` | `canonicalUrl`（有才生成） |
| 2 | `heading_2`（加粗题目标题） | `title ?? problemKey` |
| 3 | `bulleted_list_item` × 1 | `problemUnderstanding` 浓缩为首条要点 |
| 4 | `bulleted_list_item` × N | `coreIdea[]` 逐项 |
| 5 | `code` | `code` 字段；语言从代码内容推断（`java`/`python`/`cpp`，默认 `plain text`） |
| 6 | `bulleted_list_item` × 1 | `复杂度：${complexity}`（有才生成） |
| 7 | `divider` | 固定 |

`content.kind === 'text'` 时：bookmark（如有）+ heading_2 + 整段 `paragraph` + divider。

限制处理：

- Notion 单个 rich_text 上限 2000 字符：`chunkRichText(text)` 纯函数切片，code block 拆为多段 rich_text；超长 bulleted item 同理
- 单次 append children 上限 100 块：本功能单条目远低于此限，无需分批，但 `appendBlocks` 对 >100 块做防御性分批
- 语言推断 `detectLanguage(code)`：含 `class Solution` + `public`/`def ` 等启发式

### 4. UI 触发

- `entrypoints/app/components/AnalysisPanel.tsx` header 按钮区（`:29-35`）加「导入 Notion」按钮，仅当前 tab 有已保存分析结果时可用
- 点击 → `chrome.runtime.sendMessage({ type: 'leetx/export-notion', analysisId })`
- 结果用现有 `Toast`（`bits.tsx:39`）反馈：
  - 成功：「已导入 Notion」
  - 未配置 token/pageId：「请先在设置中配置 Notion」并打开 SettingsModal
  - 失败：显示错误分类文案（token 无效 / 页面未分享 / 网络错误）

## 数据流

```
AnalysisPanel 点击「导入 Notion」
  → leetx/export-notion { analysisId }
  → background（特权校验）
      ├─ 读 leetx:notionSettings（缺失 → 返回 not-configured）
      ├─ 读 leetx:aiAnalyses 取 SavedAnalysis
      ├─ listCaptures 按 problemKey 找 canonicalUrl/title
      ├─ formatBlocks(analysis, meta) → blocks
      └─ appendBlocks(token, pageId, blocks)（必要时先申请 origin 权限——注意：chrome.permissions.request 必须在用户手势上下文，故权限申请放 UI 侧点击时执行，background 侧用 chrome.permissions.contains 检查，缺失则返回 need-permission，UI 申请后重发）
  → Toast 反馈
```

权限细节决定：`chrome.permissions.request` 需要用户手势，因此由 `AnalysisPanel` 点击按钮时先 `contains` 检查、缺失则 `request`，成功后才发 `leetx/export-notion`。

## 错误处理

| 场景 | 行为 |
|---|---|
| 未配置 Notion | 返回 `{ ok: false, reason: 'not-configured' }`，UI 提示并开设置 |
| 缺 origin 权限 | UI 侧先申请，用户拒绝则 Toast 提示 |
| 401 | 「Token 无效，请检查设置」 |
| 403/404 | 「页面不可达，请确认已把页面分享给 Integration」 |
| 429 | background 自动重试一次后仍失败 → 「Notion 限流，请稍后重试」 |
| analysis 不存在 | 「分析结果不存在，请重新分析」 |

## 测试

- `src/notion/settings.test.ts`：`extractPageId` 各种 URL/裸 id/非法输入
- `src/notion/format.test.ts`：json/text 两种 `AIContent` 的 blocks 映射、字段缺失跳过、2000 字符切片、语言推断
- `src/notion/client.test.ts`：mock `fetch`，验证请求头、错误分类、429 重试
- `src/messaging/messages.test.ts`：新消息类型的 zod 校验

## 非目标（YAGNI）

- 不做 OAuth 公开集成
- 不做每次新建子页面 / 写入 database
- 不做「完整题目条目」风格选项
- 不做去重检测（重复导入由用户自己控制）
- 不做 markdown 渲染（AI 输出是结构化 JSON，直接映射 blocks）
