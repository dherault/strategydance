import isComposingKeyPress from '~utils/common/isComposingKeyPress'

// The part of a key press that says whether it sends
type ConversationKeyPress = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'isComposing' | 'keyCode'>

/*
  Whether a key press in the message field sends the message rather than typing into it. Enter
  sends, and Shift+Enter breaks the line. On a touch screen, which has no Shift key to hand,
  Enter breaks the line and the Send button sends, unless a keyboard's Command or Control goes
  with it.

  Nothing sends while an input method composes, as when Japanese or Chinese is typed, since its
  Enter picks what was composed
*/
function isConversationSendKey(keyPress: ConversationKeyPress, isCoarsePointer: boolean) {
  if (keyPress.key !== 'Enter' || keyPress.shiftKey) return false
  if (isComposingKeyPress(keyPress)) return false

  return !isCoarsePointer || keyPress.metaKey || keyPress.ctrlKey
}

export default isConversationSendKey
