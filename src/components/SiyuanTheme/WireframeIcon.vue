<template>
  <svg
    class="sfsr-wireframe-icon"
    :class="props.class"
    :style="{
      width: formattedSize,
      height: formattedSize,
      fill: 'none !important',
    }"
    style="fill: none !important;"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="props.strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- 1. 全局搜索/放大镜 -->
    <template v-if="props.name === 'search'">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </template>

    <!-- 2. 常用预设/星标 -->
    <template v-else-if="props.name === 'star' || props.name === 'preset'">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </template>

    <!-- 3. 批量导出/上传导出 -->
    <template v-else-if="props.name === 'export'">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </template>

    <!-- 4. 替换历史/回退事务 -->
    <template v-else-if="props.name === 'history'">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
      <path d="M3.05 11a9 9 0 0 1 .5-2m-.5 2H6m-2.95 0L2 8" />
    </template>

    <!-- 5. 高级筛选/漏斗 -->
    <template v-else-if="props.name === 'filter'">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </template>

    <!-- 6. 清除/圆圈叉号 -->
    <template v-else-if="props.name === 'clear'">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </template>

    <!-- 7. 文档/文件 -->
    <template v-else-if="props.name === 'document'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </template>

    <!-- 8. 折叠/展开箭头 Chevron Down/Right -->
    <template v-else-if="props.name === 'chevron-down'">
      <polyline points="6 9 12 15 18 9" />
    </template>
    <template v-else-if="props.name === 'chevron-right'">
      <polyline points="9 18 15 12 9 6" />
    </template>
    <template v-else-if="props.name === 'chevron'">
      <polyline points="9 18 15 12 9 6" />
    </template>

    <!-- 9. 差异对比 Visual Diff -->
    <template v-else-if="props.name === 'diff'">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
    </template>

    <!-- 10. 全词匹配 Whole Word -->
    <template v-else-if="props.name === 'whole-word'">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M7 10h2l1.5 5 1.5-5h2" />
    </template>

    <!-- 11. 关闭/叉号 -->
    <template v-else-if="props.name === 'close'">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </template>

    <!-- 12. 回滚/撤回 Revert/Undo -->
    <template v-else-if="props.name === 'revert' || props.name === 'undo'">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </template>

    <!-- 13. 设置/齿轮 Settings -->
    <template v-else-if="props.name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </template>

    <!-- 14. 展开/折叠双向箭头 Collapse/Expand All -->
    <template v-else-if="props.name === 'expand-all'">
      <polyline points="7 8 12 13 17 8" />
      <polyline points="7 14 12 19 17 14" />
    </template>
    <template v-else-if="props.name === 'collapse-all'">
      <polyline points="7 10 12 5 17 10" />
      <polyline points="7 16 12 11 17 16" />
    </template>

    <!-- 15. 链接与引用 -->
    <template v-else-if="props.name === 'link'">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </template>

    <!-- 16. SQL / 代码块嵌入 -->
    <template v-else-if="props.name === 'code'">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </template>

    <!-- 17. 剪贴板 / 复制 -->
    <template v-else-if="props.name === 'copy'">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </template>

    <!-- 18. 回车确认 Arrow Enter -->
    <template v-else-if="props.name === 'enter'">
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </template>

    <!-- 兜底通用圆圈 -->
    <template v-else>
      <circle cx="12" cy="12" r="8" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number | string
    strokeWidth?: number | string
    class?: string
  }>(),
  {
    size: 14,
    strokeWidth: 1.6,
    class: '',
  },
)

const formattedSize = computed(() => {
  if (typeof props.size === 'number') {
    return `${props.size}px`
  }
  return props.size
})
</script>

<style scoped>
.sfsr-wireframe-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  fill: none !important;
  stroke: currentColor !important;
}
</style>
