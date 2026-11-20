// @vitest-environment node

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { fetchNotebooks } from '@/features/search-replace/global/kernel-query'

const kernelMocks = vi.hoisted(() => ({
  listNotebooks: vi.fn(),
}))

vi.mock('@/features/search-replace/kernel', () => kernelMocks)

describe('fetchNotebooks', () => {
  it('loads real notebook names from the lsNotebooks API and filters closed ones', async () => {
    kernelMocks.listNotebooks.mockResolvedValue({
      notebooks: [
        {
          closed: false,
          icon: '📘',
          id: 'nb-open-1',
          name: '工作笔记',
        },
        {
          closed: true,
          icon: '',
          id: 'nb-closed',
          name: '已关闭笔记本',
        },
        {
          closed: false,
          icon: '',
          id: 'nb-open-2',
          name: '日记',
        },
      ],
    })

    const notebooks = await fetchNotebooks()

    expect(notebooks.map((notebook) => notebook.id)).toEqual(['nb-open-1', 'nb-open-2'])
    expect(notebooks[0]).toEqual({
      closed: false,
      icon: '📘',
      id: 'nb-open-1',
      name: '工作笔记',
    })
    expect(kernelMocks.listNotebooks).toHaveBeenCalledWith()
  })

  it('returns an empty list when the kernel request fails', async () => {
    kernelMocks.listNotebooks.mockRejectedValue(new Error('kernel unavailable'))

    const notebooks = await fetchNotebooks()

    expect(notebooks).toEqual([])
  })
})
