export interface HotkeySource {
  hotkey: string
  label: string
}

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Win', 'Shift'] as const
const MODIFIER_ALIASES = new Map<string, typeof MODIFIER_ORDER[number]>([
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
const MODIFIER_ONLY_KEYS = new Set(['Alt', 'Control', 'Meta', 'Shift'])
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
])

export function formatHotkeyFromEvent(event: KeyboardEvent) {
  const key = getHotkeyKey(event)
  if (!key) {
    return null
  }

  const modifiers = MODIFIER_ORDER.filter((modifier) => {
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

  const normalizedInput = hotkey
    .replace(/\u2318/g, 'Ctrl+')
    .replace(/\u2325/g, 'Alt+')
    .replace(/\u2303/g, 'Ctrl+')
    .replace(/\u21E7/g, 'Shift+')
    .trim()

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

  const orderedModifiers = MODIFIER_ORDER.filter(modifier => modifiers.has(modifier))
  return [...orderedModifiers, key].filter(Boolean).join('+')
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

function isKeymapLeaf(value: object): value is { custom: string, default: string } {
  return 'custom' in value && 'default' in value
}