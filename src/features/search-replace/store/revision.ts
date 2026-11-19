export interface RevisionGuard {
  /**
   * 递增并返回最新 revision（新一次操作开始时调用）
   */
  next: () => number
  /**
   * 判断给定 revision 是否已被更新的操作取代（过期结果应直接丢弃）
   */
  isStale: (revision: number) => boolean
  /**
   * 使所有已发出的 revision 过期（结果被外部清除时调用，如清空查询）
   */
  invalidate: () => void
}

/**
 * 创建 generation-token 风格的 revision 守卫。
 *
 * 用于隔离"发起异步操作"与"结果落盘/落状态"两个时刻之间的竞态：
 * 每次发起新操作前调用 next()，操作在 await 恢复后用 isStale() 判断
 * 是否已被更新操作取代，过期则直接丢弃结果而不是覆盖最新状态。
 */
export function createRevisionGuard(): RevisionGuard {
  let latest = 0

  return {
    next: () => {
      latest += 1
      return latest
    },
    isStale: (revision: number) => revision !== latest,
    invalidate: () => {
      latest += 1
    },
  }
}
