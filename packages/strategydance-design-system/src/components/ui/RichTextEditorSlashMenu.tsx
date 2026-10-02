import { type DefaultReactSuggestionItem, SuggestionMenuController } from '@blocknote/react'
import { type Middleware, offset, shift, size } from '@floating-ui/react'
import type { ComponentProps } from 'react'

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
  fn: async ({ elements, placement, platform, rects, strategy }) => {
    const list = elements.floating.querySelector('.bn-suggestion-menu')
    const height = Math.min(list?.scrollHeight ?? rects.floating.height, MIN_ROOM_BELOW)
    const visible = await platform.getClippingRect({
      element: elements.floating,
      boundary: 'clippingAncestors',
      rootBoundary: 'viewport',
      strategy,
    })
    const caret = elements.reference.getBoundingClientRect()
    const below = visible.y + visible.height - caret.bottom - OFFSET - PADDING
    const above = caret.top - visible.y - OFFSET - PADDING
    const next = below >= height || below >= above ? 'bottom-start' : 'top-start'

    return next === placement ? {} : { reset: { placement: next } }
  },
}

const FLOATING_OPTIONS: FloatingOptions = {
  useFloatingOptions: {
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

// The menu "/" opens in `RichTextEditor`: BlockNote's slash menu, on the side of the caret with room for it
function RichTextEditorSlashMenuController({ getItems }: Props) {
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={getItems}
      floatingUIOptions={FLOATING_OPTIONS}
    />
  )
}

export { RichTextEditorSlashMenuController }
