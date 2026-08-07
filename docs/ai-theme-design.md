# AI 分析与主题能力增量设计

## 目标

在现有 Stage 0 采集能力上增加可选的 OpenAI 兼容 API 分析，并为 Popup 与完整工作台增加明暗主题切换。AI 能力仅处理用户明确选择的记录或提交，不改变原有本地采集和确定性分析链路。

## AI 配置

工作台设置面板提供 Base URL、API Key、模型名称和超时时间。Base URL 支持 OpenAI 兼容的 Chat Completions 端点；扩展在用户保存或测试连接时申请精确 Origin 权限。API Key 保存在 `chrome.storage.session`，浏览器完全退出后失效；Base URL、模型和超时时间保存在 `chrome.storage.local`。API Key 不进入 Content Script、页面 MAIN world 或题目网站。

节点分析发送当前题目标识、语言、判题状态、当前代码以及上一提交的代码变化。记录最终分析发送各节点判题演进、关键代码变化和最终代码。默认仅在用户点击“AI 分析”后调用，不自动产生费用。

后台 Service Worker 负责请求 AI。响应优先解析结构化 JSON；兼容端点仅返回文本时保存为 Markdown 文本。401、403、404 和参数错误直接反馈；网络错误、429 与 5xx 提供手工重试，不在 Stage 0 自动无限重试。

## 主题

主题支持 `dark`、`light` 和 `system` 三种模式，默认跟随系统。选择结果保存到 `chrome.storage.local`，Popup 与工作台共享。工作台顶栏提供快捷切换，设置面板提供完整三态选择。所有颜色通过 CSS Variables 提供，浅色模式保持三栏结构、状态色和代码区域对比度。

## 验收

AI 未配置时点击分析会打开设置面板；配置可测试连接；成功后节点和记录均可生成、保存并重新查看分析；API Key 不出现在页面存储和 Content Script 消息中。主题切换无需刷新，Popup 与工作台保持一致，浏览器重启后仍保留主题选择。
