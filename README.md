# 搜 easy —— siyuan-sou-easy

一个为思源笔记当前文档提供更接近 VS Code 的查找与替换体验的插件。

## 当前能力

- 当前文档内**逐个**查找与替换
- 上一项 / 下一项导航与当前命中计数
- 区分大小写、全词匹配、正则匹配
- 选区内查找与替换
- 替换当前、跳过当前、全部替换
- 支持按当前命中的大小写形式调整替换文本
- 顶栏入口、命令面板入口与可配置快捷键
- 搜索面板拖拽、缩放、位置记忆
- 当前文档 minimap 与实时命中同步
- IME 输入处理、文档切换回退、编辑区实时刷新

## 当前实现边界

- 仅面向当前激活文档
- 以当前编辑器 DOM 为基础做搜索与定位
- 对复杂富文本结构，部分命中可能只能搜索、暂不支持直接替换

## 项目结构

- 结构文档：`docs/project-structure.md`
- 产品文档：`docs/PRD.md`
- 开发计划：`docs/development-plan.md`
- 手工验证清单：`docs/manual-validation-checklist.md`

## 开发文档

- 插件入口：`src/index.ts`
- 状态编排入口：`src/features/search-replace/store.ts`
- 编辑器 DOM 适配入口：`src/features/search-replace/editor.ts`
- UI 模板：`src/App.vue`

## 开发与构建

```bash
pnpm install
pnpm test
pnpm precheck
pnpm build
```

如已配置 `.env` 中的 `VITE_SIYUAN_WORKSPACE_PATH`，开发时可使用：

```bash
pnpm dev
```

## 测试

- 测试框架：Vitest
- 当前回归覆盖：入口与设置、store 编排、编辑器 DOM 适配、面板交互与 minimap
- 常用命令：

```bash
pnpm exec vitest run tests/store-context.test.ts
pnpm exec vitest run tests/panel-widget.test.ts tests/minimap-widget.test.ts
```
