import { syntaxHighlighter } from '@blocknote/code-block'
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core'
import {
  FilePanelExtension,
  FormattingToolbarExtension,
  SideMenuExtension,
  SuggestionMenu,
  TableHandlesExtension,
} from '@blocknote/core/extensions'
import { withCollaboration } from '@blocknote/core/yjs'
import { DesktopFormattingToolbarController, FilePanelController, TableHandlesController } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import { type CSSProperties, type KeyboardEvent, type Ref, useEffect, useImperativeHandle, useState } from 'react'
import { RichTextEditorFilePanel } from 'strategydance-design-system/components/ui/RichTextEditorFilePanel'
import { RichTextEditorSideMenuController } from 'strategydance-design-system/components/ui/RichTextEditorSideMenu'
import { RichTextEditorSlashMenuController } from 'strategydance-design-system/components/ui/RichTextEditorSlashMenu'
import { RichTextEditorToolbar } from 'strategydance-design-system/components/ui/RichTextEditorToolbar'
import { type RichTextLabels, getRichTextDictionary } from 'strategydance-design-system/lib/getRichTextDictionary'
import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { isRichTextEmpty } from 'strategydance-design-system/lib/isRichTextEmpty'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'
import {
  RICH_TEXT_EDITOR_BLOCKS,
  RICH_TEXT_YJS_FRAGMENT,
  type RichTextEditorBlock,
  getRichTextBlockTypes,
} from 'strategydance-design-system/lib/richText'
import { getRichTextSlashMenuItems } from 'strategydance-design-system/lib/richTextEditorMenus'
import { createRichTextSchema } from 'strategydance-design-system/lib/richTextEditorSchema'
import { cn } from 'strategydance-design-system/lib/utils'
import type { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'

// Relative, since the package's `components/*` export resolves to `.tsx` modules only
import './RichTextEditor.css'

/** The menus' words BlockNote has none for, in English unless the caller's catalogue says otherwise */
type RichTextEditorLabels = RichTextLabels

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
  /** No text anywhere, nor any picture: nothing worth saving */
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
  /**
   * Stores a picture and answers with the address it is loaded from, or throws, having said why:
   * what puts a picture in from a file, the file panel's Upload tab, a paste or a drop. Left out,
   * a picture comes in by its address only. Read once, as `initialValue` is
   */
  uploadImage?: (file: File) => Promise<string>
  /** Called on ⌘Enter, or Ctrl+Enter, the shortcut to post */
  onSubmit?: () => void
  autoFocus?: boolean
  /** The app's locale code, such as 'FR', which BlockNote's menus speak, or English where they cannot */
  locale?: string
  /** The menus' words BlockNote lacks, in English unless the caller's catalogue says otherwise */
  labels?: Partial<RichTextEditorLabels>
  /**
   * The blocks it writes besides paragraphs, every one unless it says fewer. One left out is not
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
  'initialValue' | 'collaboration' | 'placeholder' | 'autoFocus' | 'locale' | 'labels' | 'uploadImage' | 'aria-label'
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
  nested by Tab, text in bold, italic, underline and strikethrough, links, code, colored in the
  language picked over it, tables, grown and headed from the handles on their edges, pictures, and
  YouTube, Vimeo and Loom videos, which is everything `RichText` draws back.

  It is uncontrolled. `initialValue` seeds it once, `onChange` reports each edit as the blocks
  `normalizeRichText` keeps, serialized, whether they say anything and how much text, and a parent that
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
  menu opens on the side of the caret with room for it, above an on-screen keyboard included, floats
  over the page rather than lengthening it, and scrolls its own list, never the page
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
  uploadImage,
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
      uploadImage,
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
        || !!editor.getExtension(FilePanelExtension)?.store.state

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

    onChange({ value: JSON.stringify(document), isEmpty: isRichTextEmpty(document), textLength: text.length })
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
        {/* Only an editor writing tables has the extension, which the handles throw without */}
        {editor.getExtension(TableHandlesExtension) ? <TableHandlesController /> : null}
        {/* Where a picture's file or a video's address is given, which opens over an empty one */}
        {blocks.includes('image') || blocks.includes('video') ? (
          <FilePanelController filePanel={RichTextEditorFilePanel} />
        ) : null}
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
  uploadImage,
  'aria-label': ariaLabel,
}: EditorOptions) {
  // The editor once made, for an upload that fails to take its block away
  const made: { editor?: Pick<BlockNoteEditor, 'getBlock' | 'removeBlocks'> } = {}

  /*
    A picture goes up through the caller, from the Upload tab, a paste and a drop alike, and
    keeps no file name, which BlockNote would read out as its alternative text. A failed upload
    takes its block away, which BlockNote would leave reading "Loading..." in every tab
  */
  async function uploadFile(upload: (file: File) => Promise<string>, file: File, blockId?: string) {
    try {
      const url = await upload(file)

      return { props: { url, name: '' } }
    } catch (error) {
      const block = blockId ? made.editor?.getBlock(blockId) : undefined

      if (block && !(block.props as { url?: string }).url) made.editor?.removeBlocks([block])

      throw error
    }
  }

  const options = {
    schema: createRichTextSchema(blocks),
    dictionary: getRichTextDictionary(locale, { ...labels, placeholder }),
    domAttributes: {
      editor: { 'aria-label': ariaLabel ?? placeholder, class: EDITOR_CLASS_NAMES[appearance] },
    },
    autofocus: autoFocus ? ('end' as const) : false,
    trailingBlock: false,
    // Colors code as shiki does, each language's grammar loaded the first time a block is in it
    extensions: blocks.includes('code') ? [syntaxHighlighter] : [],
    // A table's first row or column made a header from its handles, and no colors nor merged cells
    tables: { headers: true },
    uploadFile: uploadImage ? (file: File, blockId?: string) => uploadFile(uploadImage, file, blockId) : undefined,
  }

  // A shared text opens on its document, so nothing seeds it, and its history is Yjs' own, which
  // `withCollaboration` puts in place of BlockNote's
  if (collaboration) {
    const editor = BlockNoteEditor.create(
      withCollaboration({
        ...options,
        collaboration: {
          fragment: collaboration.doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT),
          provider: { awareness: collaboration.awareness },
          user: collaboration.user,
        },
      }),
    )

    made.editor = editor

    return editor
  }

  // BlockNote throws on an empty document, which it makes itself when given none
  const initialContent = parseRichText(initialValue, { blockTypes: getRichTextBlockTypes(blocks) })
  const editor = BlockNoteEditor.create({
    ...options,
    initialContent: initialContent.length ? (initialContent as PartialBlock[]) : undefined,
  })

  made.editor = editor

  return editor
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
