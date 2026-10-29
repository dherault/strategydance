import { createExtension } from '@blocknote/core'
import { type EditorState, Plugin, PluginKey, type Transaction } from 'prosemirror-state'

/*
  What typing a text writes in its place: arrows, each long one before the short one its text ends
  with, so `-->` makes one long arrow rather than a dash and a short one
*/
const RICH_TEXT_REPLACEMENTS: readonly { text: string; replacement: string }[] = [
  { text: '<--', replacement: '⟵' },
  { text: '-->', replacement: '⟶' },
  { text: '<-', replacement: '←' },
  { text: '->', replacement: '→' },
]

/*
  The replacement just typed, kept as prosemirror-inputrules keeps a rule's, for Tiptap's
  `undoInputRule`, which BlockNote's Backspace runs first: it steps `transform` back, then writes
  `text`, everything typed for the replacement, from `from` to `to`, where the replacement began
  and the keys' text ended. Forgotten at the next edit or move of the caret, so only the Backspace
  right after it takes it back, and the next one deletes a character
*/
type RichTextReplacement = {
  transform: Transaction
  from: number
  to: number
  text: string
  /** What it wrote at `from` */
  replacement: string
}

const REPLACEMENTS_KEY = new PluginKey<RichTextReplacement | null>('richTextReplacements')

function isCode(marks: readonly { type: { spec: { code?: boolean } } }[]) {
  return marks.some(mark => mark.type.spec.code)
}

/*
  The replacement typing `typed` over `from` to `to` makes, or null. A replacement just made
  reads as the text it replaced, so `<-` makes an arrow, and one more `-` turns it into the long
  one, which Backspace then takes back to `<--`. Code is left alone, blocks and inline alike
*/
function replaceTypedText(state: EditorState, from: number, to: number, typed: string) {
  const $from = state.doc.resolve(from)

  if ($from.parent.type.spec.code || isCode(state.storedMarks ?? $from.marks())) return null

  const last = REPLACEMENTS_KEY.getState(state)
  const lastEnd = last ? last.from + last.replacement.length : null
  // The document's text from `start` to the caret, which a mention, a break or a node's edge
  // makes shorter than the range, and so different from any text written out
  const textBefore = (start: number) => (start < $from.start() ? null : state.doc.textBetween(start, from))

  for (const { text, replacement } of RICH_TEXT_REPLACEMENTS) {
    if (!text.endsWith(typed)) continue

    let start: number | null = null

    if (last && lastEnd === from && text.endsWith(last.text + typed)) {
      const head = text.slice(0, text.length - last.text.length - typed.length)

      if (textBefore(last.from - head.length) === head + last.replacement) start = last.from - head.length
    }

    if (start === null) {
      const head = text.slice(0, text.length - typed.length)

      if (textBefore(from - head.length) === head) start = from - head.length
    }

    if (start === null) continue

    const transform = state.tr.insertText(replacement, start, to)

    return transform.setMeta(REPLACEMENTS_KEY, { transform, from: start, to, text, replacement })
  }

  return null
}

function createRichTextReplacementsPlugin() {
  return new Plugin<RichTextReplacement | null>({
    key: REPLACEMENTS_KEY,
    state: {
      init: () => null,
      apply: (transaction, last) =>
        transaction.getMeta(REPLACEMENTS_KEY) ?? (transaction.docChanged || transaction.selectionSet ? null : last),
    },
    props: {
      handleTextInput(view, from, to, typed) {
        // A composition writes its text once it ends, which a replacement would cut into
        const transaction = view.composing ? null : replaceTypedText(view.state, from, to, typed)

        if (transaction) view.dispatch(transaction)

        return !!transaction
      },
    },
    // What `undoInputRule` looks for in a plugin whose state it reads
    isInputRules: true,
  })
}

/*
  The editor's typed replacements: `->` and `<-` write a short arrow, `-->` and `<--` a long one,
  as they are typed, outside code. Backspace right after one takes it back to what was typed
*/
const RichTextReplacementsExtension = createExtension(() => ({
  key: 'richTextReplacements',
  prosemirrorPlugins: [createRichTextReplacementsPlugin()],
}))

export { RichTextReplacementsExtension, createRichTextReplacementsPlugin }
