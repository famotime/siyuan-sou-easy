# 搜 easy —— siyuan-sou-easy

一个为思源笔记当前文档提供更接近 VS Code 的查找与替换体验的插件。

## 当前已实现

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

## 开发文档

- 产品文档：`docs/PRD.md`
- 开发计划：`docs/development-plan.md`
- 手工验证清单：`docs/manual-validation-checklist.md`

## 开发与构建

```bash
npm install
npm run test
npm run precheck
npm run build
```

如已配置 `.env` 中的 `VITE_SIYUAN_WORKSPACE_PATH`，开发时可使用：

```bash
npm run dev
```
