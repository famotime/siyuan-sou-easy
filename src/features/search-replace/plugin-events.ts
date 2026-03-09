const EDITOR_CONTEXT_EVENT_NAMES = [
  'switch-protyle',
  'click-editorcontent',
  'loaded-protyle-dynamic',
  'loaded-protyle-static',
  'destroy-protyle',
] as const

interface EventBusLike {
  off: (eventName: string, handler: (...args: any[]) => void) => void
  on: (eventName: string, handler: (...args: any[]) => void) => void
}

export function bindEditorContextEvents(eventBus: EventBusLike, handler: (...args: any[]) => void) {
  EDITOR_CONTEXT_EVENT_NAMES.forEach((eventName) => {
    eventBus.on(eventName, handler)
  })
}

export function unbindEditorContextEvents(eventBus: EventBusLike, handler: (...args: any[]) => void) {
  EDITOR_CONTEXT_EVENT_NAMES.forEach((eventName) => {
    eventBus.off(eventName, handler)
  })
}

export { EDITOR_CONTEXT_EVENT_NAMES }
