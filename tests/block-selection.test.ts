// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  pickPreferredBlockElement,
  pickPreferredSearchRoot,
} from '@/features/search-replace/editor/block-selection'

describe('editor block selection helpers', () => {
  it('prefers the visible search root over a stale root when multiple wysiwyg roots exist', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div class="protyle-wysiwyg" data-root="stale"></div>
          <div class="protyle-wysiwyg" data-root="visible"></div>
        </div>
      </div>
    `

    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const [staleRoot, visibleRoot] = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg'))

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue(createRect({
      bottom: 420,
      left: 0,
      right: 320,
      top: 120,
    }))
    vi.spyOn(staleRoot!, 'getBoundingClientRect').mockReturnValue(createRect({
      bottom: 80,
      left: 0,
      right: 320,
      top: 20,
    }))
    vi.spyOn(visibleRoot!, 'getBoundingClientRect').mockReturnValue(createRect({
      bottom: 340,
      left: 0,
      right: 320,
      top: 140,
    }))

    expect(pickPreferredSearchRoot([staleRoot!, visibleRoot!], scrollContainer)).toBe(visibleRoot)
  })

  it('prefers the latest transition root when the scroll container is still animating', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content protyle-content--transition">
          <div class="protyle-wysiwyg" data-root="old"></div>
          <div class="protyle-wysiwyg" data-root="new"></div>
        </div>
      </div>
    `

    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const [oldRoot, newRoot] = Array.from(document.querySelectorAll<HTMLElement>('.protyle-wysiwyg'))

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue(createRect({
      bottom: 420,
      left: 0,
      right: 320,
      top: 120,
    }))
    vi.spyOn(oldRoot!, 'getBoundingClientRect').mockReturnValue(createRect({
      bottom: 320,
      left: 0,
      right: 320,
      top: 140,
    }))
    vi.spyOn(newRoot!, 'getBoundingClientRect').mockReturnValue(createRect({
      bottom: 330,
      left: 0,
      right: 320,
      top: 150,
    }))

    expect(pickPreferredSearchRoot([oldRoot!, newRoot!], scrollContainer)).toBe(newRoot)
  })

  it('ignores hidden block candidates and prefers the visible one closest to the container center', () => {
    document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-content">
          <div data-node-id="block-1" data-type="NodeParagraph" class="fn__none"></div>
          <div data-node-id="block-1" data-type="NodeParagraph" data-kind="far"></div>
          <div data-node-id="block-1" data-type="NodeParagraph" data-kind="near"></div>
        </div>
      </div>
    `

    const scrollContainer = document.querySelector<HTMLElement>('.protyle-content')!
    const [hiddenCandidate, farCandidate, nearCandidate] = Array.from(document.querySelectorAll<HTMLElement>('[data-node-id="block-1"]'))

    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue(createRect({
      bottom: 400,
      left: 0,
      right: 320,
      top: 100,
    }))
    vi.spyOn(hiddenCandidate!, 'getBoundingClientRect').mockReturnValue(createRect({
      bottom: 200,
      left: 0,
      right: 320,
      top: 160,
    }))
    vi.spyOn(farCandidate!, 'getBoundingClientRect').mockReturnValue(createRect({
      bottom: 170,
      left: 0,
      right: 320,
      top: 130,
    }))
    vi.spyOn(nearCandidate!, 'getBoundingClientRect').mockReturnValue(createRect({
      bottom: 280,
      left: 0,
      right: 320,
      top: 220,
    }))

    expect(pickPreferredBlockElement([hiddenCandidate!, farCandidate!, nearCandidate!], scrollContainer))
      .toBe(nearCandidate)
  })
})

function createRect({
  bottom,
  left,
  right,
  top,
}: {
  bottom: number
  left: number
  right: number
  top: number
}): DOMRectReadOnly {
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
    x: left,
    y: top,
    toJSON: () => ({}),
  }
}
