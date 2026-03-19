<template>
  <div class="sfsr-regex-help">
    <div class="sfsr-regex-help__title">
      {{ title }}
    </div>
    <div class="sfsr-regex-help__note">
      {{ note }}
    </div>
    <ul class="sfsr-regex-help__examples">
      <li
        v-for="example in examples"
        :key="example.pattern"
      >
        <code>{{ example.pattern }}</code>
        <span>{{ example.description }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  examples: Array<{
    description: string
    pattern: string
  }>
  note: string
  title: string
}>()
</script>
