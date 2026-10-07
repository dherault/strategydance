// The part of a key press that says whether it sends
type ConversationKeyPress = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'isComposing' | 'keyCode'>

// What a key press reports while an input method composes, in every browser
const COMPOSING_KEY_CODE = 229

/*
  Whether a key press in the message field sends the message rather than typing into it. Enter
  sends, and Shift+Enter breaks the line. On a touch screen, which has no Shift key to hand,
  Enter breaks the line and the Send button sends, unless a keyboard's Command or Control goes
  with it.

  Nothing sends while an input method composes, as when Japanese or Chinese is typed, since its
  Enter picks what was composed. Safari ends the composition before it reports that Enter, so
  `isComposing` is already false there, and only its key code still says so
*/
function isConversationSendKey(keyPress: ConversationKeyPress, isCoarsePointer: boolean) {
  if (keyPress.key !== 'Enter' || keyPress.shiftKey) return false
  if (keyPress.isComposing || keyPress.keyCode === COMPOSING_KEY_CODE) return false

  return !isCoarsePointer || keyPress.metaKey || keyPress.ctrlKey
}

export default isConversationSendKey
