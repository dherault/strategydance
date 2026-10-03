import { BlockNoteEditor, type PartialBlock } from '@blocknote/core'
import { FormattingToolbarExtension, SideMenuExtension, SuggestionMenu } from '@blocknote/core/extensions'
import { withCollaboration } from '@blocknote/core/yjs'
import { DesktopFormattingToolbarController } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import { type CSSProperties, type KeyboardEvent, type Ref, useEffect, useImperativeHandle, useState } from 'react'
import { RichTextEditorSideMenuController } from 'strategydance-design-system/components/ui/RichTextEditorSideMenu'
import { RichTextEditorSlashMenuController } from 'strategydance-design-system/components/ui/RichTextEditorSlashMenu'
import { RichTextEditorToolbar } from 'strategydance-design-system/components/ui/RichTextEditorToolbar'
import { getRichTextDictionary } from 'strategydance-design-system/lib/getRichTextDictionary'
import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'
import { RICH_TEXT_YJS_FRAGMENT } from 'strategydance-design-system/lib/richText'
import { getRichTextSlashMenuItems } from 'strategydance-design-system/lib/richTextEditorMenus'
import {
  RICH_TEXT_EDITOR_BLOCKS,
  createRichTextSchema,
  getRichTextBlockTypes,
  type RichTextEditorBlock,
} from 'strategydance-design-system/lib/richTextEditorSchema'
import { cn } from 'strategydance-design-system/lib/utils'
import type { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'

// Relative, since the package's `components/*` export resolves to `.tsx` modules only
import './RichTextEditor.css'

type RichTextEditorLabels = {
  /** The block menu's item that turns a block into another, which BlockNote has no words for */
  turnInto: string
}

/** What a parent can do to the editor from outside it */
type RichTextEditorHandle = {
  /** Puts the caret in the text, as a field's Enter moves on to the one after it */
  focus: () => void
}

/**
 * `field` is a box among others, a post's or a priority's, which scrolls past a few paragraphs.
 * `document` is a page's body: no frame, and as tall as its text
 */
type RichTextEditorAppearance = 'field' | 'document'

type RichTextEditorChange = {
  /** BlockNote's blocks, serialized, which is what `RichText` draws and `initialValue` takes back */
  value: string
  /** No text anywhere: nothing worth saving */
  isEmpty: boolean
  /** How many characters its text runs to, a break between two blocks counting as one */
  textLength: number
}

/** A text several people write at once, shared through Yjs */
type RichTextEditorCollaboration = {
  /**
   * The text, which the editor opens on and writes to rather than `initialValue`. The caller's, so
   * it merges into it what the others wrote, and sends them what this reader writes
   */
  doc: Y.Doc
  /** Where each writer's caret is, this reader's included, which the editor draws for the others */
  awareness: Awareness
  /**
   * How this reader shows to the others: a name, and a color in six-digit hex, which BlockNote
   * reads to choose the label's text color
   */
  user: { name: string; color: string }
}

type Props = {
  /** Blocks as `onChange` serialized them, to start from. Read once, as everything is but the callbacks: change the `key` to start over */
  initialValue?: string | null
  /** A text written together, which the editor takes in place of `initialValue`. Read once too */
  collaboration?: RichTextEditorCollaboration
  /** What the empty document says, and its accessible name unless `aria-label` says otherwise */
  placeholder: string
  onChange?: (change: RichTextEditorChange) => void
  /** Called on ⌘Enter, or Ctrl+Enter, the shortcut to post */
  onSubmit?: () => void
  autoFocus?: boolean
  /** The app's locale code, such as 'FR', which BlockNote's menus speak, or English where they cannot */
  locale?: string
  /** The menus' words BlockNote lacks, in English unless the caller's catalogue says otherwise */
  labels?: Partial<RichTextEditorLabels>
  /**
   * The blocks it writes besides paragraphs, all four unless it says fewer. One left out is not
   * offered, and pastes as paragraphs
   */
  blocks?: readonly RichTextEditorBlock[]
  appearance?: RichTextEditorAppearance
  className?: string
  'aria-label'?: string
  ref?: Ref<RichTextEditorHandle>
}

type EditorOptions = Pick<
  Props,
  'initialValue' | 'collaboration' | 'placeholder' | 'autoFocus' | 'locale' | 'labels' | 'aria-label'
> & {
  blocks: readonly RichTextEditorBlock[]
  appearance: RichTextEditorAppearance
}

// The editable area's height, which BlockNote sets on the element it makes rather than on anything
// a class from outside reaches
const EDITOR_CLASS_NAMES: Record<RichTextEditorAppearance, string> = {
  field: 'min-h-[134px] max-h-[420px] overflow-auto',
  document: 'min-h-[360px]',
}

/*
  A rich text field: BlockNote's block editor, for a post of a few paragraphs. "/" opens a menu of
  the blocks it writes, the handle beside a block drags it, turns it into another or deletes it, and
  a selection raises a toolbar of the four styles, a link and the block it is in. Markdown's
  shortcuts work as typed.
  It writes paragraphs, headings at three levels, quotes, bulleted, numbered and check lists,
  nested by Tab, text in bold, italic, underline and strikethrough, and links, which is everything
  `RichText` draws back.

  It is uncontrolled. `initialValue` seeds it once, `onChange` reports each edit as the blocks
  `normalizeRichText` keeps, serialized, whether they hold any text and how much, and a parent that
  wants it empty again changes its `key`. `blocks` narrows what it writes, for a text shorter than
  a post. A value it cannot read, an old Lexical one included, starts it empty.

  Or it is shared: `collaboration` gives it a Yjs document to write in, where others' edits land as
  they arrive, and the caret and the name of each of them, from the awareness. The document is the
  value then, and `initialValue` goes unread. Undo takes back this reader's own edits only, and
  `onChange` reports others' edits too, so the text it reports is always the whole of it. Whatever
  arrives through the document skips `parseRichText`: the schema is what keeps the text to the
  blocks the editor writes, and a block it lacks is deleted from the document.

  It is a framed field unless `appearance` makes it a document, the body of a page under its own
  title, which has no frame and grows with its text, its side menu hanging in the page's margin,
  or below `md`, where a page has none, in a gutter of its own on the left.
  `ref` takes a handle that focuses it from outside.

  Its menus portal into the editor itself, so inside a modal dialog they are inside the dialog, and
  while one is open Escape closes it rather than the dialog. The toolbar floats over the selection
  on touch screens too, since BlockNote's mobile toolbar would portal outside the dialog. The slash
  menu opens on the side of the caret with room for it, above an on-screen keyboard included, and
  scrolls its own list, never the page
*/
function RichTextEditor({
  initialValue,
  collaboration,
  placeholder,
  onChange,
  onSubmit,
  autoFocus = false,
  locale,
  labels,
  blocks = RICH_TEXT_EDITOR_BLOCKS,
  appearance = 'field',
  className,
  'aria-label': ariaLabel,
  ref,
}: Props) {
  const [editor] = useState(() =>
    createEditor({
      initialValue,
      collaboration,
      placeholder,
      autoFocus,
      locale,
      labels,
      blocks,
      appearance,
      'aria-label': ariaLabel,
    }),
  )
  const [getSlashMenuItems] = useState(() => getRichTextSlashMenuItems(editor))

  useImperativeHandle(ref, () => ({ focus: () => editor.focus() }), [editor])

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
      data-appearance={appearance}
      className={cn(
        appearance === 'field'
          && 'rounded-xs border border-border bg-white transition-colors duration-150 ease-in-out focus-within:border-secondary',
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
        sideMenu={false}
        formattingToolbar={false}
        emojiPicker={false}
        filePanel={false}
        tableHandles={false}
        comments={false}
        onChange={handleChange}
      >
        <RichTextEditorSlashMenuController getItems={getSlashMenuItems} />
        <RichTextEditorSideMenuController />
        <DesktopFormattingToolbarController formattingToolbar={RichTextEditorToolbar} />
      </BlockNoteView>
    </div>
  )
}

function createEditor({
  initialValue,
  collaboration,
  placeholder,
  autoFocus,
  locale,
  labels,
  blocks,
  appearance,
  'aria-label': ariaLabel,
}: EditorOptions) {
  const options = {
    schema: createRichTextSchema(blocks),
    dictionary: getRichTextDictionary(locale, { placeholder, turnInto: labels?.turnInto }),
    domAttributes: {
      editor: { 'aria-label': ariaLabel ?? placeholder, class: EDITOR_CLASS_NAMES[appearance] },
    },
    autofocus: autoFocus ? ('end' as const) : false,
    trailingBlock: false,
  }

  // A shared text opens on its document, so nothing seeds it, and its history is Yjs' own, which
  // `withCollaboration` puts in place of BlockNote's
  if (collaboration) {
    return BlockNoteEditor.create(
      withCollaboration({
        ...options,
        collaboration: {
          fragment: collaboration.doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT),
          provider: { awareness: collaboration.awareness },
          user: collaboration.user,
        },
      }),
    )
  }

  // BlockNote throws on an empty document, which it makes itself when given none
  const initialContent = parseRichText(initialValue, { blockTypes: getRichTextBlockTypes(blocks) })

  return BlockNoteEditor.create({
    ...options,
    initialContent: initialContent.length ? (initialContent as PartialBlock[]) : undefined,
  })
}

export {
  RichTextEditor,
  type RichTextEditorAppearance,
  type RichTextEditorBlock,
  type RichTextEditorChange,
  type RichTextEditorCollaboration,
  type RichTextEditorHandle,
  type RichTextEditorLabels,
}
