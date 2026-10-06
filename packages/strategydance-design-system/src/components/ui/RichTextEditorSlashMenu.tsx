import {
  type DefaultReactSuggestionItem,
  SuggestionMenuController,
  type SuggestionMenuProps,
  useComponentsContext,
  useDictionary,
} from '@blocknote/react'
import { type Middleware, detectOverflow, offset, shift, size } from '@floating-ui/react'
import { type ComponentProps, useEffect, useRef } from 'react'

type FloatingOptions = NonNullable<ComponentProps<typeof SuggestionMenuController>['floatingUIOptions']>

// BlockNote's own distances: from the caret, and from the edges of what is visible
const OFFSET = 10
const PADDING = 10

// The height of three rows, which the menu wants below the caret before it opens there
const MIN_ROOM_BELOW = 160

/*
  Opens the menu below the caret when its rows fit there, or three of them do, or there is no more
  room above, and above it otherwise. BlockNote leaves this to `autoPlacement`, which measures the
  menu as `size` has just capped it: once the rows replace the loader, a cap that fits below makes
  it fit below, so it stays there. Above an on-screen keyboard that left a sliver of a menu, and a
  cap that flipped between the two sides on every update. The list's full height is what it
  measures here, which no cap changes
*/
const placeByRoom: Middleware = {
  name: 'placeByRoom',
  fn: async state => {
    const list = state.elements.floating.querySelector('.bn-suggestion-menu')
    const height = Math.min(list?.scrollHeight ?? state.rects.floating.height, MIN_ROOM_BELOW)
    // How far the caret sits from each edge of what is visible, in the coordinates floating-ui
    // places the menu in. On iOS those are shifted by the keyboard's pan when the menu is fixed,
    // which a rectangle read off the page directly is not
    const overflow = await detectOverflow(state, { elementContext: 'reference', padding: PADDING })
    const below = -overflow.bottom - OFFSET
    const above = -overflow.top - OFFSET
    const next = below >= height || below >= above ? 'bottom-start' : 'top-start'

    return next === state.placement ? {} : { reset: { placement: next } }
  },
}

/*
  Fixed, the menu floats over the viewport rather than sitting in the page, so it never lengthens
  what the page scrolls through. BlockNote sets it absolute, in the page: placed for an instant
  below a caret near the page's end, with the height it was about to take above it, it reached past
  the page's end and lengthened it. Chrome on iOS, which fits the page to the space over the
  keyboard, answered by scrolling the page by that much
*/
const FLOATING_OPTIONS: FloatingOptions = {
  useFloatingOptions: {
    strategy: 'fixed',
    middleware: [
      offset(OFFSET),
      placeByRoom,
      shift(),
      size({
        apply: ({ elements, availableHeight }) => {
          elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`
        },
        padding: PADDING,
      }),
    ],
  },
}

type Props = {
  getItems: (query: string) => Promise<DefaultReactSuggestionItem[]>
}

/*
  The menu "/" opens in `RichTextEditor`: BlockNote's slash menu, placed on the side of the caret
  with room for it, and with rows of its own that keep the chosen one in view by scrolling the
  list alone
*/
function RichTextEditorSlashMenuController({ getItems }: Props) {
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      shouldOpen={isOutsideTable}
      getItems={getItems}
      suggestionMenuComponent={RichTextEditorSlashMenu}
      floatingUIOptions={FLOATING_OPTIONS}
    />
  )
}

// Whether the caret is outside a table, whose cells hold text alone: "/" types a slash there
const isOutsideTable: NonNullable<ComponentProps<typeof SuggestionMenuController>['shouldOpen']> = state =>
  !state.selection.$from.parent.type.isInGroup('tableContent')

// BlockNote's menu, its groups' names, its loader and its empty row, with the rows below
function RichTextEditorSlashMenu({
  items,
  loadingState,
  selectedIndex,
  onItemClick,
}: SuggestionMenuProps<DefaultReactSuggestionItem>) {
  const Components = useComponentsContext()!
  const dictionary = useDictionary()

  const rows = items.flatMap((item, index) => {
    const row = (
      <SlashMenuRow
        key={item.title}
        index={index}
        item={item}
        isSelected={index === selectedIndex}
        onClick={() => onItemClick?.(item)}
      />
    )

    if (item.group === items[index - 1]?.group) return [row]

    return [
      <Components.SuggestionMenu.Label
        key={`group-${item.group}`}
        className="bn-suggestion-menu-label"
      >
        {item.group}
      </Components.SuggestionMenu.Label>,
      row,
    ]
  })

  return (
    <Components.SuggestionMenu.Root
      id="bn-suggestion-menu"
      className="bn-suggestion-menu"
    >
      {rows}
      {rows.length === 0 && (loadingState === 'loading' || loadingState === 'loaded') ? (
        <Components.SuggestionMenu.EmptyItem className="bn-suggestion-menu-item">
          {dictionary.suggestion_menu.no_items_title}
        </Components.SuggestionMenu.EmptyItem>
      ) : null}
      {loadingState === 'loading-initial' || loadingState === 'loading' ? (
        <Components.SuggestionMenu.Loader className="bn-suggestion-menu-loader" />
      ) : null}
    </Components.SuggestionMenu.Root>
  )
}

type SlashMenuRowProps = {
  index: number
  item: DefaultReactSuggestionItem
  isSelected: boolean
  onClick: () => void
}

/*
  A row as BlockNote's shadcn flavour draws it, which `RichTextEditor.css` dresses: its icon, its
  name over a line about it, and its shortcut. Drawn here because BlockNote's row brings the
  chosen one into view with `scrollIntoView`, which scrolls the page too. The rows render before
  the menu is placed, while it sits at the page's top left with its height already capped, so a
  row that overflowed it then could scroll the page to its top. This one scrolls the list and
  nothing else.

  Its id is the one BlockNote gives the editor as its active descendant, and a press on it keeps
  the focus in the text
*/
function SlashMenuRow({ index, item, isSelected, onClick }: SlashMenuRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const row = rowRef.current
    const list = row?.closest('.bn-suggestion-menu')

    if (!isSelected || !row || !list) return

    const rowRect = row.getBoundingClientRect()
    const listRect = list.getBoundingClientRect()

    if (rowRect.top < listRect.top) list.scrollTop -= listRect.top - rowRect.top
    else if (rowRect.bottom > listRect.bottom) list.scrollTop += rowRect.bottom - listRect.bottom
  }, [isSelected])

  return (
    <div
      ref={rowRef}
      id={`bn-suggestion-menu-item-${index}`}
      role="option"
      aria-selected={isSelected || undefined}
      className="bn-suggestion-menu-item relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0"
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      {item.icon ? <div data-position="left">{item.icon}</div> : null}
      <div className="flex-1">
        <div>{item.title}</div>
        {item.subtext ? <div>{item.subtext}</div> : null}
      </div>
      {item.badge ? (
        <div data-position="right">
          <span data-slot="badge">{item.badge}</span>
        </div>
      ) : null}
    </div>
  )
}

export { RichTextEditorSlashMenuController }
