import {
  formatHotkeyFromEvent,
  normalizeHotkey,
} from '@/hotkeys'

export const HOTKEY_CAPTURE_INPUT_ATTRIBUTE = 'data-friendly-search-hotkey-input'

export function createColorSettingElement(
  value: string,
  defaultValue: string,
  resetLabel: string,
  onChange: (value: string) => Promise<boolean>,
) {
  const wrapper = document.createElement('div')
  wrapper.className = 'fn__flex'
  wrapper.style.alignItems = 'center'
  wrapper.style.flexWrap = 'wrap'
  wrapper.style.gap = '8px'

  const textInput = document.createElement('input')
  textInput.className = 'b3-text-field'
  textInput.type = 'text'
  textInput.autocomplete = 'off'
  textInput.spellcheck = false
  textInput.style.flex = '1 1 160px'
  textInput.style.minWidth = '0'

  const colorInput = document.createElement('input')
  colorInput.type = 'color'
  colorInput.className = 'b3-text-field'
  colorInput.style.flex = '0 0 44px'
  colorInput.style.width = '44px'
  colorInput.style.minWidth = '44px'
  colorInput.style.padding = '2px'

  const resetButton = document.createElement('button')
  resetButton.className = 'b3-button b3-button--outline'
  resetButton.type = 'button'
  resetButton.textContent = resetLabel
  resetButton.style.flex = '0 0 auto'

  let currentValue = value

  const syncInputs = (nextValue: string) => {
    textInput.value = nextValue
    colorInput.value = toColorInputValue(nextValue, defaultValue)
  }

  const commitValue = async (nextValue: string) => {
    const accepted = await onChange(nextValue)
    if (accepted) {
      currentValue = nextValue
      syncInputs(currentValue)
      return
    }

    syncInputs(currentValue)
  }

  syncInputs(currentValue)

  textInput.addEventListener('change', async () => {
    await commitValue(textInput.value.trim())
  })
  textInput.addEventListener('blur', () => {
    if (!textInput.value.trim()) {
      syncInputs(currentValue)
    }
  })

  colorInput.addEventListener('input', () => {
    textInput.value = colorInput.value
  })
  colorInput.addEventListener('change', async () => {
    await commitValue(colorInput.value)
  })

  resetButton.addEventListener('click', async () => {
    await commitValue(defaultValue)
  })

  wrapper.append(textInput, colorInput, resetButton)
  return wrapper
}

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

function toColorInputValue(value: string, fallback: string) {
  return normalizeHexColor(value) || normalizeHexColor(fallback) || '#000000'
}

function normalizeHexColor(value: string) {
  const normalized = value.trim().toLowerCase()
  if (/^#[\da-f]{6}$/.test(normalized)) {
    return normalized
  }

  if (/^#[\da-f]{3}$/.test(normalized)) {
    const [, r, g, b] = normalized
    return `#${r}${r}${g}${g}${b}${b}`
  }

  return null
}
