// The part of a key press that says whether an input method is composing
type ComposingKeyPress = Pick<KeyboardEvent, 'isComposing' | 'keyCode'>

// What a key press reports while an input method composes, in every browser
const COMPOSING_KEY_CODE = 229

/*
  Whether a key press belongs to an input method composing, as when Japanese or Chinese is typed,
  or a phone's keyboard suggests the word being typed: its Enter picks what was composed, and its
  arrows move through the candidates. Safari ends the composition before it reports the Enter that
  commits it, so `isComposing` is already false there, and only its key code still says so
*/
function isComposingKeyPress(keyPress: ComposingKeyPress) {
  return keyPress.isComposing || keyPress.keyCode === COMPOSING_KEY_CODE
}

export default isComposingKeyPress
