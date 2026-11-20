<template>
  <PopupModalShell
    :visible="visible"
    icon="star"
    title="常用搜索预设"
    modal-class="sfsr-popup-modal--presets"
    @close="$emit('close')"
  >
    <div class="sfsr-preset-create-row">
      <input
        v-model="newPresetName"
        class="sfsr-preset-input"
        type="text"
        placeholder="输入新预设名称..."
        @keydown.enter="onSaveCurrentAsPreset"
      >
      <button
        class="sfsr-btn sfsr-btn--primary"
        type="button"
        @click="onSaveCurrentAsPreset"
      >
        保存当前条件
      </button>
    </div>
    <div class="sfsr-preset-list">
      <div
        v-if="presetList.length === 0"
        class="sfsr-empty-tip"
      >
        暂无保存的预设
      </div>
      <div
        v-for="p in presetList"
        :key="p.id"
        class="sfsr-preset-item"
      >
        <span
          class="sfsr-preset-name"
          @click="onApplyPreset(p)"
        >
          <strong>{{ p.name }}</strong> ({{ p.query }})
        </span>
        <button
          class="sfsr-preset-del"
          type="button"
          aria-label="删除预设"
          @click="onDeletePreset(p.id)"
        >
          <WireframeIcon
            name="close"
            :size="12"
          />
        </button>
      </div>
    </div>
  </PopupModalShell>
</template>

<script setup lang="ts">
// 拆分自 GlobalSearchDockView.vue（RF-107）：常用预设管理弹窗。
// 保存/删除在弹窗内闭环；应用预设（写回 query/options/filters 并触发搜索）交还父组件。
import type { SavedSearchPreset } from '../saved-presets'
import {
  ref,
  watch,
} from 'vue'
import WireframeIcon from '@/components/SiyuanTheme/WireframeIcon.vue'
import {
  deletePreset,
  getSavedPresets,
  loadSavedPresets,
  savePreset,
} from '../saved-presets'
import { globalSearchState } from '../store'
import PopupModalShell from './PopupModalShell.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', preset: SavedSearchPreset): void
}>()

const newPresetName = ref('')
const presetList = ref<SavedSearchPreset[]>([])

// 打开弹窗时加载最新预设列表（与原 togglePresetsMenu 的"开启时才加载"时序一致）
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      void refreshPresets()
    }
  },
)

async function refreshPresets() {
  await loadSavedPresets()
  presetList.value = getSavedPresets()
}

async function onSaveCurrentAsPreset() {
  if (!newPresetName.value.trim()) {
    alert('请输入预设名称')
    return
  }
  await savePreset(newPresetName.value, {
    query: globalSearchState.query,
    replacement: globalSearchState.replacement,
    options: globalSearchState.options,
    filters: globalSearchState.filters,
  })
  newPresetName.value = ''
  presetList.value = getSavedPresets()
  alert('预设保存成功！')
}

function onApplyPreset(preset: SavedSearchPreset) {
  emit('apply', preset)
}

async function onDeletePreset(id: string) {
  await deletePreset(id)
  presetList.value = getSavedPresets()
}
</script>

<style scoped>
.sfsr-preset-create-row {
  display: flex;
  gap: 6px;
}

.sfsr-preset-input {
  flex: 1;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.25));
  background: var(--b3-theme-surface, transparent);
  color: inherit;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}

.sfsr-preset-input:focus {
  border-color: var(--b3-theme-primary);
}

.sfsr-btn--primary {
  height: 28px;
  padding: 0 10px;
  background: var(--b3-theme-primary);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.sfsr-preset-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.sfsr-empty-tip {
  text-align: center;
  color: var(--b3-theme-on-surface-light);
  font-size: 12px;
  padding: 16px 0;
}

.sfsr-preset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--b3-theme-surface, transparent);
  border: 1px solid var(--b3-border-color, rgba(128, 128, 128, 0.1));
  border-radius: 4px;
  font-size: 12px;
}

.sfsr-preset-name {
  cursor: pointer;
  color: var(--b3-theme-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.sfsr-preset-del {
  background: none;
  border: none;
  color: var(--b3-theme-error);
  cursor: pointer;
  font-size: 12px;
  padding: 2px;
  display: inline-flex;
  align-items: center;
}
</style>
