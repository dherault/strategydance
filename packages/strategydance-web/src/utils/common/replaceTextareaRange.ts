// A piece of a field's text to replace, from `start` to `end`, and what replaces it
export type TextareaEdit = {
  start: number
  end: number
  insert: string
}

/*
  Writes into a field as typing would: it fires `input`, so a controlled field's `onChange` reads
  the new text as it reads a key press, the caret lands after what was written, and the browser's
  undo takes it back. `execCommand` is deprecated, yet it is still the one way to write text the
  undo history records, in every browser the app supports. Where it writes nothing, the text is
  replaced by hand, and `input` fired for it, which undo then cannot take back
*/
function replaceTextareaRange(textarea: HTMLTextAreaElement, { start, end, insert }: TextareaEdit) {
  textarea.focus()
  textarea.setSelectionRange(start, end)

  if (document.execCommand('insertText', false, insert)) return

  textarea.setRangeText(insert, start, end, 'end')
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

export default replaceTextareaRange
