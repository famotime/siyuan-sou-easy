// 面板/迷你地图共享的布局常量与小工具（RF-110）。
// 原先 PANEL_MARGIN 与 clamp 定义在 minimap-layout.ts 中，被 use-panel-frame
// 反向依赖（面板框架逻辑不应依赖迷你地图布局模块），现提至中立位置。

export const PANEL_MARGIN = 8

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
