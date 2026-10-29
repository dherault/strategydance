import { describe, expect, it } from 'bun:test'

import { undoInputRule } from 'prosemirror-inputrules'
import { EditorState, type Plugin, TextSelection, type Transaction } from 'prosemirror-state'
import { getHeadlessRichTextEditor } from 'strategydance-design-system/lib/getHeadlessRichTextEditor'
import { RICH_TEXT_EDITOR_BLOCKS } from 'strategydance-design-system/lib/richText'
import { createRichTextReplacementsPlugin } from 'strategydance-design-system/lib/richTextReplacementsExtension'

type TextInputView = Parameters<NonNullable<Plugin['props']['handleTextInput']>>[0]

const schema = getHeadlessRichTextEditor(RICH_TEXT_EDITOR_BLOCKS).pmSchema

/*
  The parts of an editor's view the plugin reads, over one block holding `text`, a paragraph unless
  it says otherwise, the caret after it. Its state applies what it dispatches
*/
function createView(text = '', { block = 'paragraph', isCode = false } = {}) {
  const content = text ? schema.text(text, isCode ? [schema.marks.code.create()] : []) : undefined
  const doc = schema.node('doc', null, [
    schema.node('blockGroup', null, [schema.node('blockContainer', { id: 'a' }, [schema.node(block, null, content)])]),
  ])
  const plugin = createRichTextReplacementsPlugin()
  const view = {
    state: EditorState.create({ doc, plugins: [plugin], selection: TextSelection.atEnd(doc) }),
    composing: false,
    dispatch(transaction: Transaction) {
      view.state = view.state.apply(transaction)
    },
  }

  // Each key goes to the plugin first, as the view hands it over, and is written as it is otherwise
  function type(keys: string) {
    for (const key of keys) {
      const { from, to } = view.state.selection
      const isHandled = plugin.props.handleTextInput?.call(
        plugin,
        view as unknown as TextInputView,
        from,
        to,
        key,
        () => view.state.tr.insertText(key, from, to),
      )

      if (!isHandled) view.dispatch(view.state.tr.insertText(key, from, to))
    }
  }

  // As BlockNote's Backspace with the caret in text: Tiptap's undoInputRule, the same as this one, then a character
  function backspace() {
    if (undoInputRule(view.state, view.dispatch)) return

    const { from } = view.state.selection

    view.dispatch(view.state.tr.delete(from - 1, from))
  }

  return { view, type, backspace, read: () => view.state.doc.textContent }
}

describe('RichTextReplacementsExtension', () => {
  it('writes a short arrow for -> and <-, and a long one for --> and <--, as they are typed', () => {
    for (const [typed, written] of [
      ['a -> b', 'a → b'],
      ['a <- b', 'a ← b'],
      ['a --> b', 'a ⟶ b'],
      ['a <-- b', 'a ⟵ b'],
      ['->-><-', '→→←'],
    ]) {
      const editor = createView()

      editor.type(typed)

      expect(editor.read()).toBe(written)
    }
  })

  it('takes a replacement back to what was typed on the Backspace right after it, then deletes a character', () => {
    for (const [typed, undone, deleted] of [
      ['a ->', 'a ->', 'a -'],
      ['a <-', 'a <-', 'a <'],
      ['a -->', 'a -->', 'a --'],
      ['a <--', 'a <--', 'a <-'],
    ]) {
      const editor = createView()

      editor.type(typed)
      editor.backspace()

      expect(editor.read()).toBe(undone)

      editor.backspace()

      expect(editor.read()).toBe(deleted)
    }
  })

  it('leaves a replacement once anything else is typed or the caret moves', () => {
    const typedOn = createView()

    typedOn.type('-> ')
    typedOn.backspace()
    typedOn.backspace()

    expect(typedOn.read()).toBe('')

    const moved = createView()

    moved.type('a->')
    moved.view.dispatch(moved.view.state.tr.setSelection(TextSelection.create(moved.view.state.doc, 4)))
    moved.view.dispatch(moved.view.state.tr.setSelection(TextSelection.atEnd(moved.view.state.doc)))
    moved.backspace()

    expect(moved.read()).toBe('a')
  })

  it('keeps the text Backspace took a replacement back to', () => {
    const editor = createView()

    editor.type('->')
    editor.backspace()
    editor.type(' ')

    expect(editor.read()).toBe('-> ')
  })

  it('writes the replacement over a selection', () => {
    const editor = createView('a-bc')

    editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 5, 7)))
    editor.type('>')

    expect(editor.read()).toBe('a→')

    editor.backspace()

    expect(editor.read()).toBe('a->')
  })

  it('leaves code alone, in a block of code or inline', () => {
    const block = createView('', { block: 'codeBlock' })
    const inline = createView('a', { isCode: true })

    block.type('a -> b <-- c')
    inline.type('->')

    expect(block.read()).toBe('a -> b <-- c')
    expect(inline.read()).toBe('a->')
  })

  it('leaves inline code alone once code is turned off after it', () => {
    const editor = createView('a-', { isCode: true })

    // As ⌘E does at the end of the code
    editor.view.dispatch(editor.view.state.tr.setStoredMarks([]))
    editor.type('>')

    expect(editor.read()).toBe('a->')
    expect(editor.view.state.doc.rangeHasMark(5, 6, schema.marks.code)).toBe(false)
  })

  it('writes nothing while a composition is under way', () => {
    const editor = createView()

    editor.view.composing = true
    editor.type('->')

    expect(editor.read()).toBe('->')
  })
})
