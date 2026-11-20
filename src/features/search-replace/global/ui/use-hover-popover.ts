import {
  onUnmounted,
  ref,
} from 'vue'

// 拆分自 GlobalSearchDockView.vue（RF-107）：搜索语法/正则两套 hover 弹窗
// 共用的「延迟开启 / 延迟关闭 / 取消计时器」逻辑。
// 两个弹窗的互斥关闭（开启一方时先关另一方）由调用方显式编排。

export interface HoverPopoverOptions {
  /** 触发点 hover 后延迟开启的毫秒数（0 表示立即开启） */
  openDelay?: number
  /** 离开后延迟关闭的毫秒数 */
  closeDelay?: number
  /** 弹窗被打开时回调（用于编排互斥，如关闭另一个弹窗） */
  onOpen?: () => void
}

export function useHoverPopover(options: HoverPopoverOptions = {}) {
  const {
    openDelay = 0,
    closeDelay = 160,
    onOpen,
  } = options
  const isOpen = ref(false)
  let openTimer: ReturnType<typeof setTimeout> | null = null
  let closeTimer: ReturnType<typeof setTimeout> | null = null

  function cancelOpenTimer() {
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = null
    }
  }

  function cancelCloseTimer() {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
  }

  function cancelTimers() {
    cancelOpenTimer()
    cancelCloseTimer()
  }

  function open() {
    cancelTimers()
    isOpen.value = true
    onOpen?.()
  }

  function close() {
    cancelTimers()
    isOpen.value = false
  }

  function scheduleOpen(delay = openDelay) {
    cancelCloseTimer()
    if (isOpen.value) {
      return
    }

    if (delay <= 0) {
      open()
      return
    }

    cancelOpenTimer()
    openTimer = setTimeout(() => {
      openTimer = null
      open()
    }, delay)
  }

  function scheduleClose(delay = closeDelay) {
    cancelOpenTimer()
    cancelCloseTimer()
    closeTimer = setTimeout(() => {
      closeTimer = null
      isOpen.value = false
    }, delay)
  }

  onUnmounted(() => {
    cancelTimers()
  })

  return {
    cancelCloseTimer,
    cancelOpenTimer,
    cancelTimers,
    close,
    isOpen,
    open,
    scheduleClose,
    scheduleOpen,
  }
}
