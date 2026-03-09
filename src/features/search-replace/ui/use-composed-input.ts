export function useComposedInput(onCommit: (value: string) => void) {
  let isComposing = false

  function onInput(event: Event) {
    if (isComposing) {
      return
    }

    onCommit((event.target as HTMLInputElement).value)
  }

  function onCompositionStart() {
    isComposing = true
  }

  function onCompositionEnd(event: CompositionEvent) {
    isComposing = false
    onCommit((event.target as HTMLInputElement).value)
  }

  return {
    onCompositionEnd,
    onCompositionStart,
    onInput,
  }
}
