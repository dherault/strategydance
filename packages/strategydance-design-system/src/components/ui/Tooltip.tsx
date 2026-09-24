import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { type ComponentProps, type ReactNode, isValidElement } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

// The rotated square that draws the arrow, and so how far Radix pushes the tooltip out for it
const ARROW_SIZE = 8

type Props = Omit<ComponentProps<typeof TooltipPrimitive.Content>, 'content' | 'children' | 'side' | 'align' | 'sideOffset'> & {
  /** One short line of plain text. Anything interactive belongs in a popover */
  content: ReactNode
  /** An element gets the tooltip directly, anything else is wrapped in an inline-flex span */
  children: ReactNode
  /** Flips to the other side when there is no room. Defaults to top */
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  /** The gap to the trigger in px: 8 with the arrow, 4 without */
  sideOffset?: number
  /** Milliseconds of hover before it opens. Defaults to 0 */
  delay?: number
  arrow?: boolean
  /** A keyboard hint in a kbd chip after the text, such as "⌘K" */
  shortcut?: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
}

// Opens on hover and keyboard focus, and closes on press or Escape
function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  sideOffset,
  delay = 0,
  arrow = true,
  shortcut,
  open,
  defaultOpen,
  onOpenChange,
  disabled = false,
  className,
  ...props
}: Props) {
  if (disabled || !content) return children

  const trigger = isValidElement(children) && typeof children.type === 'string'
    ? children
    : (
        <span className="inline-flex align-middle">
          {children}
        </span>
      )

  return (
    <TooltipPrimitive.Provider delayDuration={delay}>
      <TooltipPrimitive.Root
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
      >
        <TooltipPrimitive.Trigger asChild>
          {trigger}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            data-slot="tooltip"
            side={side}
            align={align}
            // Radix adds the arrow's size to the offset, and the gap is measured without it
            sideOffset={(sideOffset ?? (arrow ? 8 : 4)) - (arrow ? ARROW_SIZE : 0)}
            collisionPadding={8}
            className={cn(
              'z-200 box-border w-max max-w-[min(280px,calc(100vw-16px))] rounded-xs border border-border bg-popover px-3 py-1.5 font-sans text-xs leading-[1.4] font-normal text-pretty text-popover-foreground shadow-xs antialiased',
              'animate-in duration-150 ease-out fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-0.5 data-[side=left]:slide-in-from-right-0.5 data-[side=right]:slide-in-from-left-0.5 data-[side=top]:slide-in-from-bottom-0.5',
              'data-[state=closed]:animate-out data-[state=closed]:duration-100 data-[state=closed]:ease-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              className,
            )}
            {...props}
          >
            {content}
            {shortcut
              ? (
                  <kbd className="ml-2 inline-flex h-4 items-center rounded-xs border border-border bg-neutral-50 px-1 align-[1px] font-mono text-[10px] text-muted-foreground">
                    {shortcut}
                  </kbd>
                )
              : null}
            {arrow
              ? (
                  // The arrow is a square straddling the edge, its inner half hiding the tooltip's
                  // border. Radix draws it for the top side and rotates its wrapper for the others,
                  // so the two borders on the bottom corner outline every side's arrow
                  <TooltipPrimitive.Arrow
                    width={ARROW_SIZE}
                    height={ARROW_SIZE}
                    className="block size-2 -translate-y-1/2 rotate-45 border-r border-b border-border bg-popover fill-transparent"
                  />
                )
              : null}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

export { Tooltip }
