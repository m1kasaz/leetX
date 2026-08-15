# leetX

本地优先的刷题记录浏览器扩展：在 LeetCode（力扣）和洛谷题目页自动采集你的提交代码与判题结果，聚合为刷题记录，并提供历史记录、提交时间线、代码对比与 AI 分析工作台。所有数据保存在浏览器本地（IndexedDB），无需自建后端。

## 下载与安装

### 下载

统一入口：**[Releases 页面](https://github.com/m1kasaz/leetX/releases/latest)**

在最新版本的 Assets 中下载 `leetx-<版本号>-chrome.zip` 并解压。

### 安装（Chrome / Edge）

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）。
2. 打开右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择上一步解压出的目录。
4. 固定扩展图标，方便打开工作台页面。

## 使用

1. 正常访问力扣（leetcode.cn / leetcode.com）或洛谷题目页并提交代码，扩展会自动保存提交代码与判题结果。
2. 同一题在时间窗口内（默认 90 分钟，可配置）的连续提交会聚合为一条刷题记录。
3. 打开扩展工作台页面，查看历史记录、提交时间线与代码差异。
4. 在工作台中手动触发 AI 分析：节点级分析（错误原因、复杂度、修改建议）与记录级总结（解题过程、知识点与复习建议）。AI 分析需要你在扩展设置中配置自己的 API Key，不会自动调用，费用可控。

## 常见问题

- **提交后立即关闭页面**：代码与提交时间已保存，判题结果会显示为「结果待补齐」，下次访问相关页面时自动补齐，也可手工修正。
- **隐私**：所有数据仅存储在本地浏览器中；AI 分析仅在你手动触发时，将你选择的代码发送到你配置的 API 端点。

## 从源码构建

```bash
npm install
npm run build        # 产物在 .output/chrome-mv3/
npx wxt zip          # 生成可分发的 zip 到 .output/
```

开发调试：`npm run dev`。

## 技术栈

WXT (Manifest V3) + TypeScript + React，本地存储使用 IndexedDB，数据校验使用 Zod。
