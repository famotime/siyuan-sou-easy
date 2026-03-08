# 搜 easy —— siyuan-sou-easy

一个为思源笔记当前文档提供更接近 VS Code 的查找与替换体验的插件。

## 当前能力

- 当前文档内查找
- 上一项 / 下一项导航
- 区分大小写、全词匹配、正则匹配
- 替换当前、跳过当前、全部替换
- 支持按当前命中的大小写形式调整替换文本
- 顶栏入口与命令面板入口

## 当前实现边界

- 仅面向当前激活文档
- 以当前编辑器 DOM 为基础做搜索与定位
- 对复杂富文本结构，部分命中可能只能搜索、暂不支持直接替换

## 项目状态

- 已完成搜索替换主编排层与编辑器 DOM 边界层的内部拆分
- 对外 API 仍保持在 `src/features/search-replace/store.ts` 与 `src/features/search-replace/editor.ts`
- 当前自动化测试覆盖搜索、替换、上下文回退、实时刷新、块采集、快捷键与设置等核心行为

## 开发文档

- 产品文档：`docs/PRD.md`
- 开发计划：`docs/development-plan.md`
- 项目结构：`docs/project-structure.md`
- 重构计划：`docs/refactor-plan.md`
- 手工验证清单：`docs/manual-validation-checklist.md`

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

## 代码结构概览

- `src/index.ts`：插件生命周期、命令、设置面板与事件入口
- `src/plugin-commands.ts`：命令注册、事件绑定与热键同步
- `src/plugin-settings.ts`：设置面板项构建与热键输入/冲突处理
- `src/main.ts`：挂载和销毁 Vue 根实例
- `src/App.vue`：搜索替换面板 UI 与交互
- `src/features/search-replace/store*.ts`：状态、上下文、持久化、替换编排
- `src/features/search-replace/editor*.ts`：编辑器上下文识别、块采集、高亮与替换定位
- `tests/`：Vitest 自动化测试与 SiYuan mock
