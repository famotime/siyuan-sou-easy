let debugLoggingEnabled = false

export function setDebugLoggingEnabled(enabled: boolean) {
  debugLoggingEnabled = enabled
}

export function isDebugLoggingEnabled() {
  return debugLoggingEnabled
}

export function debugLog(...args: unknown[]) {
  if (!debugLoggingEnabled) {
    return
  }

  console.info('[sfsr]', ...args)
}

export function debugRect(rect: DOMRect | DOMRectReadOnly | null | undefined) {
  if (!rect) {
    return null
  }

  return {
    bottom: roundDebugNumber(rect.bottom),
    height: roundDebugNumber(rect.height),
    left: roundDebugNumber(rect.left),
    right: roundDebugNumber(rect.right),
    top: roundDebugNumber(rect.top),
    width: roundDebugNumber(rect.width),
    x: roundDebugNumber(rect.x),
    y: roundDebugNumber(rect.y),
  }
}

export function debugElement(element: Element | null | undefined) {
  if (!(element instanceof Element)) {
    return null
  }

  const htmlElement = element instanceof HTMLElement ? element : null
  const dataset = htmlElement
    ? Object.fromEntries(Object.entries(htmlElement.dataset))
    : {}

  return {
    className: htmlElement?.className ?? '',
    dataset,
    hiddenByClass: Boolean(htmlElement?.closest('.fn__none, .protyle-attr')),
    rect: htmlElement ? debugRect(htmlElement.getBoundingClientRect()) : null,
    tagName: element.tagName.toLowerCase(),
    textPreview: (htmlElement?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80),
  }
}

function roundDebugNumber(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : value
}
