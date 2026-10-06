import type { BlockConfig, PartialBlock } from '@blocknote/core'
import { SideMenuExtension, SuggestionMenu } from '@blocknote/core/extensions'
import {
  type BlockTypeSelectItem,
  RemoveBlockItem,
  SideMenuController,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useExtension,
  useExtensionState,
  usePortalElement,
} from '@blocknote/react'
import { GripVerticalIcon, PlusIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import type { RichTextDictionary } from 'strategydance-design-system/lib/getRichTextDictionary'
import { getRichTextBlockTypeItems } from 'strategydance-design-system/lib/richTextEditorMenus'

// Lucide's, at the stroke the design's icons are drawn with rather than BlockNote's heavier ones
const ICON_SIZE = 18
const ICON_STROKE_WIDTH = 1.5

type FloatingOptions = NonNullable<ComponentProps<typeof SideMenuController>['floatingUIOptions']>
type Middleware = NonNullable<NonNullable<NonNullable<FloatingOptions['useFloatingOptions']>['middleware']>[number]>

/*
  Centers the side menu on its block's first line, measured, where BlockNote shifts it by an amount
  per block type that fits its own heading sizes rather than the design's
*/
// How far below its line's center the menu sits beside a heading, by level, which reads as centered
// on the larger display text. A heading at the second level is the one with no level attribute
const HEADING_NUDGES: Record<string, number> = { '1': 1, '2': 1 }

const centerOnFirstLine: Middleware = {
  name: 'centerOnFirstLine',
  fn: ({ y, rects, elements }) => {
    // BlockNote positions it against a virtual element wrapping the block's
    const { reference } = elements
    const block = reference instanceof Element ? reference : reference.contextElement
    const content = block?.querySelector('.bn-block-content')

    if (!content) return {}

    const style = getComputedStyle(content)
    const lineHeight = Number.parseFloat(style.lineHeight)

    if (!Number.isFinite(lineHeight)) return {}

    const lineTop =
      content.getBoundingClientRect().top - reference.getBoundingClientRect().top + Number.parseFloat(style.paddingTop)

    const nudge =
      content.getAttribute('data-content-type') === 'heading'
        ? (HEADING_NUDGES[content.getAttribute('data-level') ?? '2'] ?? 0)
        : 0

    return { y: y + lineTop + (lineHeight - rects.floating.height) / 2 + nudge }
  },
}

const FLOATING_OPTIONS: FloatingOptions = { useFloatingOptions: { middleware: [centerOnFirstLine] } }

/*
  The menu beside the block under the pointer in `RichTextEditor`, BlockNote's own buttons with
  Lucide's icons, centered on the block's first line. The "+" opens the slash menu, in the block
  when it is empty and under it otherwise. The handle drags the block, and a click on it opens the
  block's menu
*/
function RichTextEditorSideMenuController() {
  return (
    <SideMenuController
      sideMenu={RichTextEditorSideMenu}
      floatingUIOptions={FLOATING_OPTIONS}
    />
  )
}

function RichTextEditorSideMenu() {
  const Components = useComponentsContext()!

  return (
    <Components.SideMenu.Root className="bn-side-menu">
      <AddBlockButton />
      <DragHandleButton />
    </Components.SideMenu.Root>
  )
}

function AddBlockButton() {
  const Components = useComponentsContext()!
  const dictionary = useDictionary()
  const editor = useBlockNoteEditor()
  const suggestionMenu = useExtension(SuggestionMenu)
  const block = useExtensionState(SideMenuExtension, { editor, selector: state => state?.block })

  if (!block) return null

  // An empty block of text takes the menu itself. Any other block gets a paragraph after it, as
  // the menu never opens in code, where "/" is typed as code
  function addBlock() {
    if (!block) return

    const isEmptyText = hasInlineContent(editor, block.type) && Array.isArray(block.content) && !block.content.length
    const target = isEmptyText ? block : editor.insertBlocks([{ type: 'paragraph' }], block, 'after')[0]

    editor.setTextCursorPosition(target)
    suggestionMenu.openSuggestionMenu('/')
  }

  return (
    <Components.SideMenu.Button
      className="bn-button"
      label={dictionary.side_menu.add_block_label}
      icon={
        <PlusIcon
          size={ICON_SIZE}
          strokeWidth={ICON_STROKE_WIDTH}
        />
      }
      onClick={addBlock}
    />
  )
}

// While its menu is open the side menu stays on the block, wherever the pointer goes
function DragHandleButton() {
  const Components = useComponentsContext()!
  const portalElement = usePortalElement()
  const dictionary = useDictionary()
  const sideMenu = useExtension(SideMenuExtension)
  const block = useExtensionState(SideMenuExtension, { selector: state => state?.block })

  if (!block) return null

  return (
    <Components.Generic.Menu.Root
      position="left"
      portalElement={portalElement}
      onOpenChange={(isOpen: boolean) => (isOpen ? sideMenu.freezeMenu() : sideMenu.unfreezeMenu())}
    >
      <Components.Generic.Menu.Trigger>
        <Components.SideMenu.Button
          className="bn-button"
          label={dictionary.side_menu.drag_handle_label}
          icon={
            <GripVerticalIcon
              size={ICON_SIZE}
              strokeWidth={ICON_STROKE_WIDTH}
            />
          }
          draggable
          onDragStart={event => sideMenu.blockDragStart(event, block)}
          onDragEnd={() => sideMenu.blockDragEnd()}
        />
      </Components.Generic.Menu.Trigger>
      <BlockMenu />
    </Components.Generic.Menu.Root>
  )
}

/*
  The block's menu: "Turn into", a submenu of the blocks the editor writes, which the toolbar's
  select offers too, then BlockNote's delete. Over a selection holding the block, both act on every
  block it holds. The block's own type is a checked item, so it is announced as the current one; the
  others stay plain items, since a checkbox item would keep the menu open once it is chosen.

  Only a block of text or code turns into another, which keeps its text: any other would lose what
  it holds, so a selection's pictures, videos, cards and tables stay as they are
*/
function BlockMenu() {
  const Components = useComponentsContext()!
  const portalElement = usePortalElement()
  const dictionary = useDictionary() as RichTextDictionary
  const editor = useBlockNoteEditor()
  const block = useExtensionState(SideMenuExtension, { editor, selector: state => state?.block })

  const items = getRichTextBlockTypeItems(editor)

  function isCurrent(item: BlockTypeSelectItem) {
    if (!block || item.type !== block.type) return false

    const props = block.props as Record<string, unknown>

    return Object.entries(item.props ?? {}).every(([name, value]) => props[name] === value)
  }

  function turnInto(item: BlockTypeSelectItem) {
    if (!block) return

    const selectedBlocks = editor.getSelection()?.blocks
    // Of a selection, only the blocks holding text turn, as a picture or a table would lose what it holds
    const blocks = selectedBlocks?.some(selected => selected.id === block.id)
      ? selectedBlocks.filter(selected => hasText(editor, selected.type))
      : [block]
    const update = { type: item.type, props: item.props } as PartialBlock

    editor.transact(() => {
      for (const each of blocks) editor.updateBlock(each, update)
    })
  }

  return (
    <Components.Generic.Menu.Dropdown className="bn-menu-dropdown bn-drag-handle-menu">
      {block && hasText(editor, block.type) ? (
        <Components.Generic.Menu.Root
          position="right"
          sub
          portalElement={portalElement}
        >
          <Components.Generic.Menu.Trigger sub>
            <Components.Generic.Menu.Item
              className="bn-menu-item"
              subTrigger
            >
              {dictionary.drag_handle.turn_into_menuitem}
            </Components.Generic.Menu.Item>
          </Components.Generic.Menu.Trigger>
          <Components.Generic.Menu.Dropdown
            sub
            className="bn-menu-dropdown"
          >
            {items.map(item => {
              const Icon = item.icon

              return (
                <Components.Generic.Menu.Item
                  key={item.name}
                  className="bn-menu-item"
                  icon={<Icon size={16} />}
                  checked={isCurrent(item) || undefined}
                  onClick={() => turnInto(item)}
                >
                  {item.name}
                </Components.Generic.Menu.Item>
              )
            })}
          </Components.Generic.Menu.Dropdown>
        </Components.Generic.Menu.Root>
      ) : null}
      <RemoveBlockItem>{dictionary.drag_handle.delete_menuitem}</RemoveBlockItem>
    </Components.Generic.Menu.Dropdown>
  )
}

// What a block of the type holds: text with styles and links, plain text, a table, or none
function readContent(editor: { schema: { blockSchema: object } }, type: string) {
  return (editor.schema.blockSchema as Partial<Record<string, BlockConfig>>)[type]?.content
}

// Whether a block of the type holds text with styles and links: a paragraph, a heading, a list item
function hasInlineContent(editor: { schema: { blockSchema: object } }, type: string) {
  return readContent(editor, type) === 'inline'
}

// Whether a block of the type holds text, code's plain text included
function hasText(editor: { schema: { blockSchema: object } }, type: string) {
  const content = readContent(editor, type)

  return content === 'inline' || content === 'plain'
}

export { RichTextEditorSideMenuController }
