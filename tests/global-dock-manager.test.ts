import type { MockInstance } from 'vitest'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,

  vi,
} from 'vitest'

import {
  destroyGlobalSearchDock,
  initGlobalSearchDock,
  isGlobalSearchDockVisible,
  toggleGlobalSearchDock,
} from '@/features/search-replace/global/dock-manager'
import { setPluginInstance } from '@/plugin-instance'

describe('dock manager visibility states', () => {
  let dockElement: HTMLElement
  let tabButton: HTMLElement
  let clickSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''

    setPluginInstance({
      app: { appId: 'app-1' },
      name: 'siyuan-sou-easy',
    } as any)

    dockElement = document.createElement('div')
    dockElement.id = 'sfsr-dock-element'
    document.body.appendChild(dockElement)

    // 思源 dock 栏上的本插件 tab 按钮：激活态由 dock__item--active 标识
    tabButton = document.createElement('button')
    tabButton.setAttribute('data-type', 'siyuan-sou-easy-dock-tab')
    document.body.appendChild(tabButton)
    clickSpy = vi.spyOn(tabButton, 'click')

    initGlobalSearchDock(dockElement)
  })

  afterEach(() => {
    destroyGlobalSearchDock()
    setPluginInstance(null as any)
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  function setActive(active: boolean) {
    tabButton.classList.toggle('dock__item--active', active)
  }

  it('treats the tab active class as the authoritative visibility signal', () => {
    setActive(false)
    expect(isGlobalSearchDockVisible()).toBe(false)

    setActive(true)
    expect(isGlobalSearchDockVisible()).toBe(true)
  })

  it('clicks the tab button to open the dock while it is closed', () => {
    setActive(false)

    toggleGlobalSearchDock(false)

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('closes and returns focus when the dock is visible and the input is focused', () => {
    setActive(true)
    const input = document.querySelector<HTMLInputElement>('.sfsr-dock-input')!
    input.focus()

    toggleGlobalSearchDock(false)

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('does not fold the dock when it is already active but the input is not focused', () => {
    setActive(true)

    toggleGlobalSearchDock(false)

    // 本 tab 已激活：点击 tab 按钮会被思源切换为折叠，因此必须只聚焦不点击
    expect(clickSpy).not.toHaveBeenCalled()
  })
})
