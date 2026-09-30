import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, HeadingNode, QuoteNode } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  type EditorState,
  FORMAT_TEXT_COMMAND,
  KEY_ENTER_COMMAND,
  REDO_COMMAND,
  type TextFormatType,
  TextNode,
  UNDO_COMMAND,
} from 'lexical'
import {
  BoldIcon,
  Heading2Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  Redo2Icon,
  StrikethroughIcon,
  TextQuoteIcon,
  UnderlineIcon,
  Undo2Icon,
} from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'
import { RICH_TEXT_CLASS_NAME, RICH_TEXT_THEME } from 'strategydance-design-system/lib/richText'
import { cn } from 'strategydance-design-system/lib/utils'

type RichTextEditorLabels = {
  toolbar: string
  bold: string
  italic: string
  underline: string
  strikethrough: string
  heading: string
  bulletedList: string
  numberedList: string
  quote: string
  undo: string
  redo: string
}

type RichTextEditorChange = {
  /** The editor state, serialized, which is what `RichText` draws and `initialValue` takes back */
  value: string
  /** No text anywhere: nothing worth saving */
  isEmpty: boolean
  /** How many characters its text runs to, a line between two blocks counting as two */
  textLength: number
}

/** A block the toolbar can turn a paragraph into, lists being one, bulleted and numbered alike */
type RichTextBlock = 'h2' | 'quote' | 'list'

type Props = {
  /** A serialized editor state to start from. Read once, on mount: change the `key` to start over */
  initialValue?: string | null
  /** Shown while it is empty, and its accessible name unless `aria-label` says otherwise */
  placeholder: string
  onChange?: (change: RichTextEditorChange) => void
  /** Called on ⌘Enter, or Ctrl+Enter, the shortcut to post */
  onSubmit?: () => void
  autoFocus?: boolean
  /** The toolbar's words. The defaults are English: a caller with a catalogue passes its own */
  labels?: Partial<RichTextEditorLabels>
  /**
   * The blocks it writes besides paragraphs, all three unless it says fewer. One left out has no
   * button, and pastes as paragraphs
   */
  blocks?: RichTextBlock[]
  className?: string
  'aria-label'?: string
}

type BlockType = 'paragraph' | 'h2' | 'quote' | 'bullet' | 'number' | 'other'

type ToolbarState = {
  blockType: BlockType
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  isStrikethrough: boolean
  canUndo: boolean
  canRedo: boolean
}

const DEFAULT_LABELS: RichTextEditorLabels = {
  toolbar: 'Formatting',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  heading: 'Heading',
  bulletedList: 'Bulleted list',
  numberedList: 'Numbered list',
  quote: 'Quote',
  undo: 'Undo',
  redo: 'Redo',
}

const INITIAL_TOOLBAR_STATE: ToolbarState = {
  blockType: 'paragraph',
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  canUndo: false,
  canRedo: false,
}

const ALL_BLOCKS: RichTextBlock[] = ['h2', 'quote', 'list']

/*
  A rich text field: a toolbar over a Lexical editor, for a post of a few paragraphs. It writes
  paragraphs, one heading level, quotes, bulleted and numbered lists, and bold, italic, underline
  and strikethrough, which is everything `RichText` draws back.

  It is uncontrolled. `initialValue` seeds it once, `onChange` reports each edit as the serialized
  state, whether it holds any text and how much, and a parent that wants it empty again changes
  its `key`. `blocks` narrows what it writes, for a text shorter than a post.

  What is pasted in keeps only what the toolbar could have made: inline styles are dropped and any
  heading becomes the one level, so nothing is saved that the page would not draw
*/
function RichTextEditor({
  initialValue,
  placeholder,
  onChange,
  onSubmit,
  autoFocus = false,
  labels,
  blocks = ALL_BLOCKS,
  className,
  'aria-label': ariaLabel,
}: Props) {
  // A block's nodes are registered only when it is offered, so a pasted one, whose nodes the editor
  // then does not know, reads as paragraphs
  const hasLists = blocks.includes('list')
  const nodes = [
    ...(blocks.includes('h2') ? [HeadingNode] : []),
    ...(blocks.includes('quote') ? [QuoteNode] : []),
    ...(hasLists ? [ListNode, ListItemNode] : []),
  ]
  const initialConfig = {
    namespace: 'strategydance-rich-text',
    nodes,
    theme: RICH_TEXT_THEME,
    editorState: isSerializedEditorState(initialValue) ? initialValue : undefined,
    onError: (error: Error) => {
      console.error('The rich text editor failed', error)
    },
  }

  function handleChange(editorState: EditorState) {
    if (!onChange) return

    const text = editorState.read(() => $getRoot().getTextContent())

    onChange({ value: JSON.stringify(editorState.toJSON()), isEmpty: text.trim() === '', textLength: text.length })
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        data-slot="rich-text-editor"
        className={cn(
          'rounded-xs border border-border bg-white transition-colors duration-150 ease-in-out focus-within:border-secondary',
          className,
        )}
      >
        <RichTextToolbar
          labels={{ ...DEFAULT_LABELS, ...labels }}
          blocks={blocks}
        />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                aria-label={ariaLabel ?? placeholder}
                aria-placeholder={placeholder}
                placeholder={
                  <div className="pointer-events-none absolute inset-x-3 top-3 text-[15px] leading-[1.6] text-neutral-400 select-none">
                    {placeholder}
                  </div>
                }
                className={cn(RICH_TEXT_CLASS_NAME, 'max-h-[420px] min-h-24 overflow-auto p-3 outline-none')}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      <HistoryPlugin delay={300} />
      {hasLists ? <ListPlugin /> : null}
      <OnChangePlugin
        ignoreSelectionChange
        onChange={handleChange}
      />
      <PastedContentPlugin />
      {onSubmit ? <SubmitShortcutPlugin onSubmit={onSubmit} /> : null}
      {autoFocus ? <AutoFocusPlugin defaultSelection="rootEnd" /> : null}
    </LexicalComposer>
  )
}

/*
  A value that would not parse would throw inside the composer, where there is no recovering, so
  it is checked first and the editor starts empty instead
*/
function isSerializedEditorState(value: string | null | undefined): value is string {
  if (!value) return false

  try {
    const parsed: unknown = JSON.parse(value)

    return typeof parsed === 'object' && parsed !== null && 'root' in parsed
  } catch {
    return false
  }
}

function RichTextToolbar({ labels, blocks }: { labels: RichTextEditorLabels; blocks: RichTextBlock[] }) {
  const [editor] = useLexicalComposerContext()
  const [state, setState] = useState(INITIAL_TOOLBAR_STATE)

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read(() => {
            const selection = $getSelection()

            if (!$isRangeSelection(selection)) return

            const anchor = selection.anchor.getNode()
            const block = anchor.getKey() === 'root' ? null : anchor.getTopLevelElement()
            const list = $getNearestNodeOfType(anchor, ListNode)
            const blockType: BlockType = list
              ? list.getListType() === 'number'
                ? 'number'
                : 'bullet'
              : !block || block.getType() === 'paragraph'
                ? 'paragraph'
                : $isHeadingNode(block)
                  ? 'h2'
                  : block.getType() === 'quote'
                    ? 'quote'
                    : 'other'

            setState(current => ({
              ...current,
              blockType,
              isBold: selection.hasFormat('bold'),
              isItalic: selection.hasFormat('italic'),
              isUnderline: selection.hasFormat('underline'),
              isStrikethrough: selection.hasFormat('strikethrough'),
            }))
          })
        }),
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          canUndo => {
            setState(current => ({ ...current, canUndo }))

            return false
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          canRedo => {
            setState(current => ({ ...current, canRedo }))

            return false
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [editor],
  )

  function formatText(format: TextFormatType) {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
  }

  // A second press on the block the selection is in turns it back into a paragraph
  function setBlock(blockType: 'h2' | 'quote') {
    editor.update(() => {
      const selection = $getSelection()

      if (!$isRangeSelection(selection)) return

      $setBlocksType(selection, () => {
        if (state.blockType === blockType) return $createParagraphNode()

        return blockType === 'h2' ? $createHeadingNode('h2') : $createQuoteNode()
      })
    })
    editor.focus()
  }

  function toggleList(listType: 'bullet' | 'number') {
    if (state.blockType === listType) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)

      return
    }

    editor.dispatchCommand(
      listType === 'bullet' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND,
      undefined,
    )
  }

  // Read here rather than at module scope, which the document shell's prerender evaluates in Node
  const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  const modifier = isApple ? '⌘' : 'Ctrl+'

  return (
    <div
      role="toolbar"
      aria-label={labels.toolbar}
      className="flex flex-wrap items-center gap-0.5 rounded-t-xs border-b border-border bg-neutral-50 p-1"
    >
      <ToolbarButton
        label={labels.bold}
        shortcut={`${modifier}B`}
        icon={<BoldIcon />}
        isActive={state.isBold}
        onClick={() => formatText('bold')}
      />
      <ToolbarButton
        label={labels.italic}
        shortcut={`${modifier}I`}
        icon={<ItalicIcon />}
        isActive={state.isItalic}
        onClick={() => formatText('italic')}
      />
      <ToolbarButton
        label={labels.underline}
        shortcut={`${modifier}U`}
        icon={<UnderlineIcon />}
        isActive={state.isUnderline}
        onClick={() => formatText('underline')}
      />
      <ToolbarButton
        label={labels.strikethrough}
        icon={<StrikethroughIcon />}
        isActive={state.isStrikethrough}
        onClick={() => formatText('strikethrough')}
      />
      {blocks.length ? <ToolbarSeparator /> : null}
      {blocks.includes('h2') ? (
        <ToolbarButton
          label={labels.heading}
          icon={<Heading2Icon />}
          isActive={state.blockType === 'h2'}
          onClick={() => setBlock('h2')}
        />
      ) : null}
      {blocks.includes('list') ? (
        <>
          <ToolbarButton
            label={labels.bulletedList}
            icon={<ListIcon />}
            isActive={state.blockType === 'bullet'}
            onClick={() => toggleList('bullet')}
          />
          <ToolbarButton
            label={labels.numberedList}
            icon={<ListOrderedIcon />}
            isActive={state.blockType === 'number'}
            onClick={() => toggleList('number')}
          />
        </>
      ) : null}
      {blocks.includes('quote') ? (
        <ToolbarButton
          label={labels.quote}
          icon={<TextQuoteIcon />}
          isActive={state.blockType === 'quote'}
          onClick={() => setBlock('quote')}
        />
      ) : null}
      <ToolbarSeparator />
      <ToolbarButton
        label={labels.undo}
        shortcut={`${modifier}Z`}
        icon={<Undo2Icon />}
        disabled={!state.canUndo}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      />
      <ToolbarButton
        label={labels.redo}
        shortcut={isApple ? '⇧⌘Z' : 'Ctrl+Y'}
        icon={<Redo2Icon />}
        disabled={!state.canRedo}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      />
    </div>
  )
}

type ToolbarButtonProps = {
  label: string
  icon: ReactNode
  shortcut?: string
  // Left out on the buttons that act rather than toggle, which are then not pressed or unpressed
  isActive?: boolean
  disabled?: boolean
  onClick: () => void
}

function ToolbarButton({ label, icon, shortcut, isActive, disabled = false, onClick }: ToolbarButtonProps) {
  return (
    <Tooltip
      content={label}
      shortcut={shortcut}
      delay={300}
    >
      <Button
        variant="transparent"
        size="sm"
        icon={icon}
        aria-label={label}
        aria-pressed={isActive}
        disabled={disabled}
        className={cn(
          'text-neutral-600 disabled:text-neutral-300 disabled:opacity-100',
          isActive && 'bg-primary-50 text-primary not-disabled:hover:bg-primary-100',
        )}
        // Keeps the selection in the editor, so the format lands on what was selected
        onMouseDown={event => event.preventDefault()}
        onClick={onClick}
      />
    </Tooltip>
  )
}

function ToolbarSeparator() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 h-4 w-px bg-neutral-200"
    />
  )
}

// ⌘Enter, or Ctrl+Enter, submits rather than breaking the line
function SubmitShortcutPlugin({ onSubmit }: { onSubmit: () => void }) {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        event => {
          if (!event || !(event.metaKey || event.ctrlKey)) return false

          event.preventDefault()
          onSubmit()

          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor, onSubmit],
  )

  return null
}

// Pasted text keeps its formats and loses its inline styles, and a pasted heading takes the one level
function PastedContentPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      mergeRegister(
        editor.registerNodeTransform(TextNode, node => {
          if (node.getStyle()) node.setStyle('')
        }),
        // Where headings are not written, a pasted one is already a paragraph
        editor.hasNodes([HeadingNode])
          ? editor.registerNodeTransform(HeadingNode, node => {
              if (node.getTag() !== 'h2') node.setTag('h2')
            })
          : () => {},
      ),
    [editor],
  )

  return null
}

export { RichTextEditor, type RichTextBlock, type RichTextEditorChange, type RichTextEditorLabels }
