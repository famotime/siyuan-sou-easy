# 思源插件开发文档

本目录是针对思源笔记插件开发的本地参考与工程指导文档。

## 适用范围

- 适用版本：SiYuan `v3.8.5`（核对日期：2026-09-25）
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.8.5`（2026-09-25）
- 前端核心库：`siyuan@1.2.8` / `siyuan-petal@1.2.8`
- 主要受众：思源笔记插件开发者（TypeScript/JavaScript/Goja）
- 数据来源：官方仓库、官方模板（`siyuan-plugin-sample`）、`petal` 类型定义库与已验证工程实践

## 同步策略

- 版本演进层（`00`）：全面记录从 v3.7.3、v3.8.3 到 v3.8.5 的版本变更、新增特性与 API 迁移指南。
- 主文档层（`01`~`06`）：面向插件开发实战，涵盖初始化、插件 API、内核 API、数据库 AV、块模型与发布流程。
- 附录索引层（`07`）：面向官方全量 725+ 条路由与公开 API 索引，追踪权限与废弃风险。

## 推荐阅读路径

1. 最新版本演进与重大变化：[SiYuan-v3.8.5开发进展与API迁移指南.md](00-version/SiYuan-v3.8.5开发进展与API迁移指南.md)
2. 历史演进参考：[SiYuan-v3.8.3开发进展与API迁移指南.md](00-version/SiYuan-v3.8.3开发进展与API迁移指南.md)
3. 入门与总结（含速查+完整）：[插件开发入门与工程实践.md](01-start/插件开发入门与工程实践.md)
4. 关键概念与数据架构速览：[关键概念与数据架构速览.md](01-start/关键概念与数据架构速览.md)
5. 插件 API 与生命周期：[02-plugin-api/](02-plugin-api/)
6. 内核 API 与权限边界：[03-kernel-api/](03-kernel-api/)
7. 数据库与 AV 视图：[04-database-av/](04-database-av/)
8. 块模型与块属性规范：[05-block-model/块模型与属性规范.md](05-block-model/块模型与属性规范.md)
9. 插件发布服务规范与只读模式：[06-guides/插件发布服务规范与只读模式适配指南.md](06-guides/插件发布服务规范与只读模式适配指南.md)
10. 调试与发布流程：[06-guides/调试与发布流程.md](06-guides/调试与发布流程.md)
11. 设置页控件与布局 FAQ：[06-guides/插件设置页开关与控件布局FAQ.md](06-guides/插件设置页开关与控件布局FAQ.md)
12. 官方全量公开 API 索引：[07-official-index/官方API全量索引-按模块.md](07-official-index/官方API全量索引-按模块.md)
13. router 路由变更与风险索引：[07-official-index/router路由变更与风险索引.md](07-official-index/router路由变更与风险索引.md)

## 目录结构

- `00-version/`：版本迁移专区（含 v3.7.3、v3.8.3 与 v3.8.5 最新全量升级记录）
- `01-start/`：环境搭建、模板工程骨架、关键概念与数据架构速览
- `02-plugin-api/`：Plugin 生命周期、常用方法、事件总线、类型定义与最小示例
- `03-kernel-api/`：公开 API 导航、调用示例、非公开 API 风险说明，以及官方 `API_zh_CN.md` 和 `router.go`
- `04-database-av/`：属性视图（AV/数据库）增删改查、日历/列表视图、富文本与公式、SQL 结构与表字段详解
- `05-block-model/`：块模型、块类型映射表（含 NodeCustomBlock 与 NodeTabs）、列表思维导图属性、块属性清单
- `06-guides/`：插件发布服务规范与只读模式、调试与发布流程、集市上架规范、SDK 使用边界、设置页开关与控件布局 FAQ
- `07-official-index/`：官方 API 全量索引与 router.go 路由风险评级

## 文档使用约定

每篇核心文档都包含固定头部字段：

- 适用版本
- 官方仓库同步到
- 最后核对日期
- 稳定性（stable / internal / deprecated）
- 权威来源链接

## 快速入口

- 最新演进指南：[00-version/SiYuan-v3.8.5开发进展与API迁移指南.md](00-version/SiYuan-v3.8.5开发进展与API迁移指南.md)
- 发布服务适配：[06-guides/插件发布服务规范与只读模式适配指南.md](06-guides/插件发布服务规范与只读模式适配指南.md)
- 插件入门实践：[01-start/插件开发入门与工程实践.md](01-start/插件开发入门与工程实践.md)
- 关键架构概念：[01-start/关键概念与数据架构速览.md](01-start/关键概念与数据架构速览.md)
- 设置页布局 FAQ：[06-guides/插件设置页开关与控件布局FAQ.md](06-guides/插件设置页开关与控件布局FAQ.md)
- 官方 API 全量索引：[07-official-index/官方API全量索引-按模块.md](07-official-index/官方API全量索引-按模块.md)
- router 风险索引：[07-official-index/router路由变更与风险索引.md](07-official-index/router路由变更与风险索引.md)
