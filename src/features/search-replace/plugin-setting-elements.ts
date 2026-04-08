import {
  formatHotkeyFromEvent,
  normalizeHotkey,
} from '@/hotkeys'

export const HOTKEY_CAPTURE_INPUT_ATTRIBUTE = 'data-friendly-search-hotkey-input'

export function createHotkeyInputElement(
  value: string,
  onChange: (value: string) => Promise<boolean>,
) {
  const input = document.createElement('input')
  input.className = 'b3-text-field fn__size200'
  input.autocomplete = 'off'
  input.setAttribute(HOTKEY_CAPTURE_INPUT_ATTRIBUTE, 'true')
  input.placeholder = '点击后按下快捷键'
  input.readOnly = true
  input.spellcheck = false

  let currentValue = normalizeHotkey(value) || value
  input.value = currentValue

  input.addEventListener('click', () => {
    input.focus()
    input.select()
  })
  input.addEventListener('focus', () => {
    input.select()
  })
  input.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      input.value = currentValue
      input.blur()
      return
    }

    const hotkey = formatHotkeyFromEvent(event)
    if (!hotkey) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    input.value = hotkey
    const accepted = await onChange(hotkey)
    if (accepted) {
      currentValue = hotkey
    } else {
      input.value = currentValue
    }

    input.blur()
  })

  return input
}

export function createCheckboxElement(
  checked: boolean,
  onChange: (checked: boolean) => Promise<void>,
) {
  const input = document.createElement('input')
  input.className = 'b3-switch fn__flex-center'
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', async () => {
    await onChange(input.checked)
  })
  return input
}

export function createNumberInputElement(
  value: number,
  onChange: (value: number) => Promise<boolean>,
) {
  const input = document.createElement('input')
  input.className = 'b3-text-field fn__size200'
  input.type = 'number'
  input.min = '1'
  input.step = '1'

  let currentValue = normalizeNumberValue(value)
  input.value = String(currentValue)

  input.addEventListener('change', async () => {
    const nextValue = normalizeNumberValue(Number.parseInt(input.value, 10))
    input.value = String(nextValue)
    const accepted = await onChange(nextValue)
    if (accepted) {
      currentValue = nextValue
      return
    }

    input.value = String(currentValue)
  })

  input.addEventListener('blur', () => {
    if (!input.value.trim()) {
      input.value = String(currentValue)
    }
  })

  return input
}

function normalizeNumberValue(value: number) {
  if (!Number.isFinite(value)) {
    return 1
  }

  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : 1
}
