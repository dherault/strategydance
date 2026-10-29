import { type ComponentProps, useEffect, useRef } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

/*
  A list of suggestions floating over a field while it is typed in, as the documents a message can
  mention: the dropdown menu's look, but its rows are never focused. The field keeps the focus
  throughout, names the list in `aria-controls` and the highlighted row in
  `aria-activedescendant`, and moves the highlight on its own key presses, so a press anywhere on
  the list, its scrollbar's included, leaves the focus where it is. Where it floats, and how tall it
  may grow, are the caller's
*/
function SuggestionList({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="suggestion-list"
      className={cn(
        'z-50 overflow-y-auto overscroll-contain rounded-xs border border-border bg-popover p-1 font-sans text-popover-foreground shadow-md duration-150 ease-out animate-in fade-in-0 slide-in-from-bottom-[2px]',
        className,
      )}
      onMouseDown={event => event.preventDefault()}
      {...props}
    />
  )
}

// What the list holds, which names the listbox through `aria-labelledby`
function SuggestionListLabel({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="suggestion-list-label"
      className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)}
      {...props}
    />
  )
}

function SuggestionListOptions({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="suggestion-list-options"
      role="listbox"
      className={cn('flex flex-col', className)}
      {...props}
    />
  )
}

type SuggestionListItemProps = Omit<ComponentProps<'div'>, 'ref'> & {
  // The row the field's Enter would pick, which its arrows move
  isHighlighted?: boolean
}

/*
  A row 32px tall that highlights in neutral-100, as a menu's does, its icon muted. The highlighted
  row is brought into view inside the list alone: `scrollIntoView` would scroll the page under it
  too
*/
function SuggestionListItem({ isHighlighted = false, className, ...props }: SuggestionListItemProps) {
  const itemRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const item = itemRef.current
    const list = item?.closest('[data-slot="suggestion-list"]')

    if (!isHighlighted || !item || !list) return

    const itemRect = item.getBoundingClientRect()
    const listRect = list.getBoundingClientRect()

    if (itemRect.top < listRect.top) list.scrollTop -= listRect.top - itemRect.top
    else if (itemRect.bottom > listRect.bottom) list.scrollTop += itemRect.bottom - listRect.bottom
  }, [isHighlighted])

  return (
    <div
      ref={itemRef}
      data-slot="suggestion-list-item"
      role="option"
      aria-selected={isHighlighted}
      data-highlighted={isHighlighted || undefined}
      className={cn(
        'relative flex min-h-8 cursor-pointer items-center gap-2 rounded-xs px-2 text-sm text-foreground outline-none select-none data-highlighted:bg-neutral-100 data-highlighted:text-secondary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 [&_svg:not([class*="text-"])]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

// What the list says when nothing matches, which a screen reader hears
function SuggestionListEmpty({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="suggestion-list-empty"
      role="status"
      className={cn('m-0 p-2 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export { SuggestionList, SuggestionListEmpty, SuggestionListItem, SuggestionListLabel, SuggestionListOptions }
