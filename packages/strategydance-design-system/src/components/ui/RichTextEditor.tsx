import { BlockNoteEditor, type PartialBlock } from '@blocknote/core'
import { FormattingToolbarExtension, SideMenuExtension, SuggestionMenu } from '@blocknote/core/extensions'
import { DesktopFormattingToolbarController, SuggestionMenuController } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import { type CSSProperties, type KeyboardEvent, useEffect, useState } from 'react'
import { RichTextEditorToolbar } from 'strategydance-design-system/components/ui/RichTextEditorToolbar'
import { getRichTextDictionary } from 'strategydance-design-system/lib/getRichTextDictionary'
import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'
import { getRichTextSlashMenuItems } from 'strategydance-design-system/lib/richTextEditorMenus'
import {
  createRichTextSchema,
  getRichTextBlockTypes,
  type RichTextEditorBlock,
} from 'strategydance-design-system/lib/richTextEditorSchema'
import { cn } from 'strategydance-design-system/lib/utils'

// Relative, since the package's `components/*` export resolves to `.tsx` modules only
import './RichTextEditor.css'

type RichTextEditorLabels = {
  /** The heading's name in the menus. BlockNote's own names its one level "Heading 2" */
  heading: string
}

type RichTextEditorChange = {
  /** BlockNote's blocks, serialized, which is what `RichText` draws and `initialValue` takes back */
  value: string
  /** No text anywhere: nothing worth saving */
  isEmpty: boolean
  /** How many characters its text runs to, a break between two blocks counting as one */
  textLength: number
}

type Props = {
  /** Blocks as `onChange` serialized them, to start from. Read once, as everything is but the callbacks: change the `key` to start over */
  initialValue?: string | null
  /** What the empty document says, and its accessible name unless `aria-label` says otherwise */
  placeholder: string
  onChange?: (change: RichTextEditorChange) => void
  /** Called on ⌘Enter, or Ctrl+Enter, the shortcut to post */
  onSubmit?: () => void
  autoFocus?: boolean
  /** The app's locale code, such as 'FR', which BlockNote's menus speak, or English where they cannot */
  locale?: string
  labels?: Partial<RichTextEditorLabels>
  /**
   * The blocks it writes besides paragraphs, all four unless it says fewer. One left out is not
   * offered, and pastes as paragraphs
   */
  blocks?: RichTextEditorBlock[]
  className?: string
  'aria-label'?: string
}

type EditorOptions = Pick<Props, 'initialValue' | 'placeholder' | 'autoFocus' | 'locale' | 'labels' | 'aria-label'> & {
  blocks: RichTextEditorBlock[]
}

const ALL_BLOCKS: RichTextEditorBlock[] = ['heading', 'quote', 'list', 'checklist']

/*
  A rich text field: BlockNote's block editor, for a post of a few paragraphs. "/" opens a menu of
  the blocks it writes, the handle beside a block drags it or deletes it, and a selection raises a
  toolbar of the four styles, a link and the block it is in. Markdown's shortcuts work as typed.
  It writes paragraphs, one heading level, quotes, bulleted, numbered and check lists, nested by
  Tab, text in bold, italic, underline and strikethrough, and links, which is everything `RichText`
  draws back.

  It is uncontrolled. `initialValue` seeds it once, `onChange` reports each edit as the blocks
  `normalizeRichText` keeps, serialized, whether they hold any text and how much, and a parent that
  wants it empty again changes its `key`. `blocks` narrows what it writes, for a text shorter than
  a post. A value it cannot read, an old Lexical one included, starts it empty.

  Its menus portal into the editor itself, so inside a modal dialog they are inside the dialog, and
  while one is open Escape closes it rather than the dialog. The toolbar floats over the selection
  on touch screens too, since BlockNote's mobile toolbar would portal outside the dialog
*/
function RichTextEditor({
  initialValue,
  placeholder,
  onChange,
  onSubmit,
  autoFocus = false,
  locale,
  labels,
  blocks = ALL_BLOCKS,
  className,
  'aria-label': ariaLabel,
}: Props) {
  const [editor] = useState(() =>
    createEditor({ initialValue, placeholder, autoFocus, locale, labels, blocks, 'aria-label': ariaLabel }),
  )
  const [getSlashMenuItems] = useState(() => getRichTextSlashMenuItems(editor))

  /*
    A Radix dialog dismisses on an Escape that reaches the document, which it hears before
    BlockNote's menus do. It leaves a prevented one alone, and BlockNote closes its menu on it all
    the same, so while a menu is open, or the focus is in one of its popovers, the key closes the
    menu and nothing else
  */
  useEffect(() => {
    function claimEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || editor.headless) return

      const target = event.target instanceof Element ? event.target : null
      const isInPopover = !!target?.closest('.rich-text-editor') && !target.closest('.bn-editor')
      const isMenuOpen =
        !!editor.getExtension(SuggestionMenu)?.shown()
        || !!editor.getExtension(FormattingToolbarExtension)?.store.state
        || !!editor.getExtension(SideMenuExtension)?.menuFrozen

      if (isInPopover || isMenuOpen) event.preventDefault()
    }

    window.addEventListener('keydown', claimEscape, { capture: true })

    return () => window.removeEventListener('keydown', claimEscape, { capture: true })
  }, [editor])

  const blockTypes = getRichTextBlockTypes(blocks)

  function handleChange() {
    if (!onChange) return

    const document = normalizeRichText(editor.document, { blockTypes })
    const text = getRichTextText(document)

    onChange({ value: JSON.stringify(document), isEmpty: text.trim() === '', textLength: text.length })
  }

  // ⌘Enter, or Ctrl+Enter, submits rather than breaking the line, ahead of the slash menu's Enter
  function handleKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
    if (!onSubmit || event.key !== 'Enter' || !(event.metaKey || event.ctrlKey) || event.nativeEvent.isComposing) return

    event.preventDefault()
    event.stopPropagation()
    onSubmit()
  }

  return (
    <div
      data-slot="rich-text-editor"
      className={cn(
        'rounded-xs border border-border bg-white transition-colors duration-150 ease-in-out focus-within:border-secondary',
        className,
      )}
      style={{ '--rich-text-placeholder': JSON.stringify(placeholder) } as CSSProperties}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <BlockNoteView
        editor={editor}
        theme="light"
        className="rich-text-editor"
        slashMenu={false}
        formattingToolbar={false}
        emojiPicker={false}
        filePanel={false}
        tableHandles={false}
        comments={false}
        onChange={handleChange}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={getSlashMenuItems}
        />
        <DesktopFormattingToolbarController formattingToolbar={RichTextEditorToolbar} />
      </BlockNoteView>
    </div>
  )
}

function createEditor({
  initialValue,
  placeholder,
  autoFocus,
  locale,
  labels,
  blocks,
  'aria-label': ariaLabel,
}: EditorOptions) {
  // BlockNote throws on an empty document, which it makes itself when given none
  const initialContent = parseRichText(initialValue, { blockTypes: getRichTextBlockTypes(blocks) })

  return BlockNoteEditor.create({
    schema: createRichTextSchema(blocks),
    initialContent: initialContent.length ? (initialContent as PartialBlock[]) : undefined,
    dictionary: getRichTextDictionary(locale, { placeholder, heading: labels?.heading }),
    domAttributes: {
      editor: { 'aria-label': ariaLabel ?? placeholder, class: 'min-h-[134px] max-h-[420px] overflow-auto' },
    },
    autofocus: autoFocus ? 'end' : false,
    trailingBlock: false,
  })
}

export { RichTextEditor, type RichTextEditorBlock, type RichTextEditorChange, type RichTextEditorLabels }
