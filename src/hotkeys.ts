export interface HotkeySource {
  hotkey: string
  label: string
}

const DISPLAY_MODIFIER_ORDER = ['Ctrl', 'Alt', 'Win', 'Shift'] as const
const COMMAND_MODIFIER_ORDER = ['Win', 'Alt', 'Shift', 'Ctrl'] as const
const MODIFIER_ALIASES = new Map<string, typeof DISPLAY_MODIFIER_ORDER[number]>([
  ['alt', 'Alt'],
  ['cmd', 'Ctrl'],
  ['command', 'Ctrl'],
  ['control', 'Ctrl'],
  ['ctrl', 'Ctrl'],
  ['meta', 'Win'],
  ['option', 'Alt'],
  ['shift', 'Shift'],
  ['super', 'Win'],
  ['win', 'Win'],
  ['windows', 'Win'],
])
const COMMAND_MODIFIER_SYMBOLS = new Map<typeof DISPLAY_MODIFIER_ORDER[number], string>([
  ['Ctrl', '⌘'],
  ['Alt', '⌥'],
  ['Win', '⌃'],
  ['Shift', '⇧'],
])
const MODIFIER_ONLY_KEYS = new Set(['Alt', 'Control', 'Meta', 'Shift'])
const COMMAND_SYMBOL_REPLACEMENTS = new Map<string, string>([
  ['⌘', 'Ctrl+'],
  ['⌥', 'Alt+'],
  ['⌃', 'Win+'],
  ['⇧', 'Shift+'],
])
const CODE_KEY_MAP = new Map<string, string>([
  ['Backquote', '`'],
  ['Backslash', '\\'],
  ['BracketLeft', '['],
  ['BracketRight', ']'],
  ['Comma', ','],
  ['Equal', '='],
  ['IntlBackslash', '\\'],
  ['Minus', '-'],
  ['Period', '.'],
  ['Quote', "'"],
  ['Semicolon', ';'],
  ['Slash', '/'],
])
const KEY_NAME_MAP = new Map<string, string>([
  [' ', 'Space'],
  ['↩', 'Enter'],
  ['⇥', 'Tab'],
  ['⌫', 'Backspace'],
  ['⌦', 'Delete'],
  ['ArrowDown', 'Down'],
  ['ArrowLeft', 'Left'],
  ['ArrowRight', 'Right'],
  ['ArrowUp', 'Up'],
  ['Backspace', 'Backspace'],
  ['Delete', 'Delete'],
  ['End', 'End'],
  ['Enter', 'Enter'],
  ['Escape', 'Escape'],
  ['Home', 'Home'],
  ['Insert', 'Insert'],
  ['PageDown', 'PageDown'],
  ['PageUp', 'PageUp'],
  ['Tab', 'Tab'],
  ['↓', 'Down'],
  ['←', 'Left'],
  ['→', 'Right'],
  ['↑', 'Up'],
])
const COMMAND_KEY_SYMBOLS = new Map<string, string>([
  ['Backspace', '⌫'],
  ['Delete', '⌦'],
  ['Down', '↓'],
  ['Enter', '↩'],
  ['Left', '←'],
  ['Right', '→'],
  ['Tab', '⇥'],
  ['Up', '↑'],
])

export function formatHotkeyFromEvent(event: KeyboardEvent) {
  const key = getHotkeyKey(event)
  if (!key) {
    return null
  }

  const modifiers = DISPLAY_MODIFIER_ORDER.filter((modifier) => {
    switch (modifier) {
      case 'Ctrl':
        return event.ctrlKey
      case 'Alt':
        return event.altKey
      case 'Win':
        return event.metaKey
      case 'Shift':
        return event.shiftKey
      default:
        return false
    }
  })

  return [...modifiers, key].join('+')
}

export function normalizeHotkey(hotkey: string | null | undefined) {
  if (typeof hotkey !== 'string') {
    return ''
  }

  const normalizedInput = expandCommandSymbols(hotkey).trim()

  if (!normalizedInput) {
    return ''
  }

  const rawTokens = normalizedInput
    .split('+')
    .map(token => token.trim())
    .filter(Boolean)

  const modifiers = new Set<typeof MODIFIER_ORDER[number]>()
  let key = ''

  rawTokens.forEach((token) => {
    const modifier = MODIFIER_ALIASES.get(token.toLowerCase())
    if (modifier) {
      modifiers.add(modifier)
      return
    }

    key = normalizeHotkeyKey(token)
  })

  const orderedModifiers = DISPLAY_MODIFIER_ORDER.filter(modifier => modifiers.has(modifier))
  return [...orderedModifiers, key].filter(Boolean).join('+')
}

export function toCommandHotkey(hotkey: string | null | undefined) {
  const normalizedDisplayHotkey = normalizeHotkey(hotkey)
  if (!normalizedDisplayHotkey) {
    return ''
  }

  const rawTokens = normalizedDisplayHotkey
    .split('+')
    .map(token => token.trim())
    .filter(Boolean)

  const modifiers = new Set<typeof DISPLAY_MODIFIER_ORDER[number]>()
  let key = ''

  rawTokens.forEach((token) => {
    const modifier = MODIFIER_ALIASES.get(token.toLowerCase())
    if (modifier) {
      modifiers.add(modifier)
      return
    }

    key = normalizeHotkeyKey(token)
  })

  const modifierSymbols = COMMAND_MODIFIER_ORDER
    .filter(modifier => modifiers.has(modifier))
    .map(modifier => COMMAND_MODIFIER_SYMBOLS.get(modifier) ?? '')
    .join('')

  return `${modifierSymbols}${toCommandHotkeyKey(key)}`
}

export function collectKeymapHotkeys(keymap: unknown, path: string[] = []): HotkeySource[] {
  if (!keymap || typeof keymap !== 'object') {
    return []
  }

  if (isKeymapLeaf(keymap)) {
    const hotkey = keymap.custom || keymap.default
    if (!hotkey) {
      return []
    }

    return [{
      hotkey,
      label: path.join('.'),
    }]
  }

  return Object.entries(keymap).flatMap(([key, value]) => collectKeymapHotkeys(value, [...path, key]))
}

export function findHotkeyConflict(hotkey: string, sources: HotkeySource[], ignoredHotkeys: string[] = []) {
  const normalizedTarget = normalizeHotkey(hotkey)
  if (!normalizedTarget) {
    return null
  }

  const ignored = new Set(ignoredHotkeys.map(normalizeHotkey).filter(Boolean))

  return sources.find((source) => {
    const normalizedSource = normalizeHotkey(source.hotkey)
    if (!normalizedSource || ignored.has(normalizedSource)) {
      return false
    }

    return normalizedSource === normalizedTarget
  }) ?? null
}

function getHotkeyKey(event: KeyboardEvent) {
  if (MODIFIER_ONLY_KEYS.has(event.key)) {
    return null
  }

  if (event.code.startsWith('Key')) {
    return event.code.slice(3).toUpperCase()
  }

  if (event.code.startsWith('Digit')) {
    return event.code.slice(5)
  }

  const codeMappedKey = CODE_KEY_MAP.get(event.code)
  if (codeMappedKey) {
    return codeMappedKey
  }

  return normalizeHotkeyKey(event.key)
}

function normalizeHotkeyKey(key: string) {
  const namedKey = KEY_NAME_MAP.get(key)
  if (namedKey) {
    return namedKey
  }

  if (/^F\d{1,2}$/i.test(key)) {
    return key.toUpperCase()
  }

  if (key.length === 1) {
    return key.toUpperCase()
  }

  return key
}

function toCommandHotkeyKey(key: string) {
  return COMMAND_KEY_SYMBOLS.get(key) ?? key
}

function expandCommandSymbols(value: string) {
  let normalized = value
  COMMAND_SYMBOL_REPLACEMENTS.forEach((replacement, symbol) => {
    normalized = normalized.replaceAll(symbol, replacement)
  })
  return normalized
}

function isKeymapLeaf(value: object): value is { custom: string, default: string } {
  return 'custom' in value && 'default' in value
}
