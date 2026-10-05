// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  destroyGlobalSearchDock,
  initGlobalSearchDock,
} from '@/features/search-replace/global/dock-manager'

describe('dock-manager', () => {
  it('mounts and unmounts global search dock view into element', () => {
    const dockEl = document.createElement('div')
    initGlobalSearchDock(dockEl)

    expect(dockEl.querySelector('.sfsr-dock-container')).not.toBeNull()
    expect(dockEl.querySelector('.sfsr-dock-panel')).not.toBeNull()
    expect(dockEl.querySelector('.sfsr-dock-input')).not.toBeNull()

    const docOnlySwitch = dockEl.querySelector('.sfsr-dock-switch') as HTMLInputElement | null
    expect(docOnlySwitch).not.toBeNull()
    expect(docOnlySwitch?.checked).toBe(true)

    destroyGlobalSearchDock()
  })
})
