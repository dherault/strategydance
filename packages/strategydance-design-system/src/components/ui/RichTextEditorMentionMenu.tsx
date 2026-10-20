import type { BlockNoteEditor } from '@blocknote/core'
import { SuggestionMenu } from '@blocknote/core/extensions'
import {
  type DefaultReactSuggestionItem,
  SuggestionMenuController,
  type SuggestionMenuProps,
  useBlockNoteEditor,
  useEditorDOMElement,
} from '@blocknote/react'
import { FileTextIcon, SquareKanbanIcon } from 'lucide-react'
import { type ComponentProps, useEffect } from 'react'
import {
  RICH_TEXT_EDITOR_MENU_FLOATING_OPTIONS,
  RichTextEditorSlashMenu,
} from 'strategydance-design-system/components/ui/RichTextEditorSlashMenu'
import type { RichTextDictionary } from 'strategydance-design-system/lib/getRichTextDictionary'
import { getRichTextMentionItems } from 'strategydance-design-system/lib/getRichTextMentionItems'
import type { RichTextMentionSource } from 'strategydance-design-system/lib/richText'
import { RichTextMentionsExtension } from 'strategydance-design-system/lib/richTextMentionsExtension'

// How long the menu waits for a list to be read before it suggests from those it has, for one that could not be
const LIST_WAIT = 5000

type MentionsStore = NonNullable<ReturnType<typeof readStore>>

/*
  The menu "@" opens in `RichTextEditor`, as the slash menu opens: the documents and the tasks
  whose title holds what is typed after it, each under its group with its icon, a pick putting a
  mention of it in place of the "@" and what was typed, and a space after it.

  It opens where a word starts, at the start of a block or after a space, so an "@" inside a word,
  an email address's, types as itself, and never in code. Tab picks the chosen row, as Enter does.
  What is typed starting with a space is no mention, so the menu closes, as Enter would otherwise
  pick or do nothing while it is open.
  Opening it asks for both lists, and while one is not read it waits, showing its loader, rather
  than closing on what it cannot suggest yet; a list that could not be read is waited for no longer
  than a few seconds. It reads the page's source from the editor's store, as its mentions do, so
  what it suggests once it has waited is what the page holds then
*/
function RichTextEditorMentionMenuController() {
  const editor = useBlockNoteEditor()
  const dictionary = editor.dictionary as RichTextDictionary

  async function getItems(query: string): Promise<DefaultReactSuggestionItem[]> {
    const store = readStore(editor)

    if (/^\s/.test(query) || !store?.state) {
      editor.getExtension(SuggestionMenu)?.closeMenu()

      return []
    }

    store.state.request('document')
    store.state.request('task')

    const source = await waitForLists(store)

    if (!source) return []

    return getRichTextMentionItems(source, query).map(item => {
      const isDocument = item.kind === 'document'

      return {
        title: item.title,
        group: isDocument ? dictionary.rich_text.mention_knowledge : dictionary.rich_text.mention_tasks,
        icon: isDocument ? <FileTextIcon size={18} /> : <SquareKanbanIcon size={18} />,
        onItemClick: () => {
          const mention = isDocument
            ? { type: 'documentMention', props: { documentId: item.id, title: item.title } }
            : { type: 'taskMention', props: { taskId: item.id, name: item.title } }

          editor.insertInlineContent([mention, ' '] as never, { updateSelection: true })
        },
      }
    })
  }

  return (
    <SuggestionMenuController
      triggerCharacter="@"
      shouldOpen={isAtWordStart}
      getItems={getItems}
      suggestionMenuComponent={RichTextEditorMentionMenu}
      floatingUIOptions={RICH_TEXT_EDITOR_MENU_FLOATING_OPTIONS}
    />
  )
}

/*
  The slash menu's look, where Tab picks the chosen row as Enter does, or does nothing while there
  is none, rather than nesting the block the "@" is typed in. BlockNote hears Enter on the editor's
  element, before the text does, from the menu while it is open, and leaves Tab to the text: the
  menu hears it the same way, so the text never does
*/
function RichTextEditorMentionMenu(props: SuggestionMenuProps<DefaultReactSuggestionItem>) {
  const { items, selectedIndex, onItemClick } = props
  const element = useEditorDOMElement()

  useEffect(() => {
    function pickOnTab(event: KeyboardEvent) {
      if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing)
        return

      event.preventDefault()
      event.stopPropagation()

      const item = selectedIndex === undefined ? undefined : items[selectedIndex]

      if (item) onItemClick?.(item)
    }

    element?.addEventListener('keydown', pickOnTab, true)

    return () => element?.removeEventListener('keydown', pickOnTab, true)
  }, [element, items, selectedIndex, onItemClick])

  return <RichTextEditorSlashMenu {...props} />
}

function readStore(editor: BlockNoteEditor<any, any, any>) {
  return editor.getExtension(RichTextMentionsExtension)?.store
}

// The source once both its lists are read, or once the menu has waited long enough for one that could not be
function waitForLists(store: MentionsStore) {
  const isReady = (source: RichTextMentionSource | null) => !source || (!!source.documents && !!source.tasks)

  return new Promise<RichTextMentionSource | null>(resolve => {
    if (isReady(store.state)) {
      resolve(store.state)

      return
    }

    const done = () => {
      clearTimeout(timer)
      unsubscribe()
      resolve(store.state)
    }
    const timer = setTimeout(done, LIST_WAIT)
    const unsubscribe = store.subscribe(({ currentVal }) => {
      if (isReady(currentVal)) done()
    })
  })
}

/*
  Whether the caret is where a word starts, at the start of a block or after a space, outside code,
  whose text is its own
*/
const isAtWordStart: NonNullable<ComponentProps<typeof SuggestionMenuController>['shouldOpen']> = state => {
  const { $from } = state.selection
  const { parent, parentOffset } = $from

  if (parent.type.spec.code) return false
  if (parentOffset === 0) return true

  return /\s/.test(parent.textBetween(parentOffset - 1, parentOffset, undefined, '￼'))
}

export { RichTextEditorMentionMenuController }
