// @vitest-environment jsdom
import { it, expect } from 'vitest'
import { isRangeReplaceable } from '../src/features/search-replace/editor/replacement'
import { locateRangeInSingleTextNode } from '../src/features/search-replace/editor/ranges'

it('debugs table replaceable 2', () => {
  document.body.innerHTML = `
      <div class="protyle">
        <div class="protyle-background" data-node-id="root-1"></div>
        <div class="protyle-title" data-node-id="root-1"></div>
        <input class="protyle-title__input" value="Doc 1" />
        <div class="protyle-wysiwyg">
          <div data-node-id="block-table" data-type="NodeTable">
            <div class="table__row">
              <div class="table__cell">
                <div contenteditable="true">Cell Alpha</div>
              </div>
              <div class="table__cell">
                <div contenteditable="true">Cell Beta</div>
              </div>
            </div>
          </div>
        </div>
      </div>
  `
  const tableBlock = document.querySelector('[data-node-id="block-table"]') as HTMLElement
  
  const location = locateRangeInSingleTextNode(tableBlock, 'Alpha', 0)
  console.log('location 2:', location)
  
  const result = isRangeReplaceable(tableBlock, 'Alpha', 0)
  console.log('isRangeReplaceable result 2:', result)
})
