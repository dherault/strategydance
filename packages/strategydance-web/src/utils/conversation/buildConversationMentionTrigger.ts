import type { TextareaEdit } from '~utils/common/replaceTextareaRange'

/*
  What "Mention a document" writes at the caret, or over what is selected: an `@`, after a space
  when it would otherwise follow a word, since a mention starts the text or follows a space
*/
function buildConversationMentionTrigger(text: string, selectionStart: number, selectionEnd: number): TextareaEdit {
  const previous = text.charAt(selectionStart - 1)

  return { start: selectionStart, end: selectionEnd, insert: previous && !/\s/.test(previous) ? ' @' : '@' }
}

export default buildConversationMentionTrigger
