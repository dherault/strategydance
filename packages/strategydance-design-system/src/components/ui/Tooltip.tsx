import { Tooltip as TooltipPrimitive } from 'radix-ui'
import {
  type ComponentProps,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  isValidElement,
  useRef,
  useState,
} from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

// The rotated square that draws the arrow, and so how far Radix pushes the tooltip out for it
const ARROW_SIZE = 8

type Props = Omit<
  ComponentProps<typeof TooltipPrimitive.Content>,
  'content' | 'children' | 'side' | 'align' | 'sideOffset'
> & {
  /** One short line of plain text. Anything interactive belongs in a popover */
  content: ReactNode
  /**
   * An element takes the tooltip's handlers, ref and `aria-describedby` itself, so a component
   * must pass its props and ref on to the DOM, as the design system's all do. Anything else, such
   * as text, is wrapped in a focusable span
   */
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
  /**
   * Stays open when its trigger is pressed, for a toggle whose tooltip says what it does now, such
   * as a lock: the reader sees the words change. Only for a trigger whose press does nothing by
   * itself, a `type="button"`, since the press's default is prevented
   */
  isKeptOpenOnPress?: boolean
  /**
   * Opens on a tap too, on a touch screen, which has no hover to open it, and closes on the next
   * tap or one outside it. For a tooltip that explains something, such as an info button's, that
   * a phone's reader would otherwise never see. Only for a trigger whose tap does nothing by
   * itself, a `type="button"`, since the tap's default is prevented
   */
  isOpenedOnTap?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
}

// Prevented, a press reaches the trigger's own handler but not Radix's, which closes the tooltip
function keepOpen(event: { preventDefault: () => void }) {
  event.preventDefault()
}

type PointerDownOutsideEvent = Parameters<
  NonNullable<ComponentProps<typeof TooltipPrimitive.Content>['onPointerDownOutside']>
>[0]

// Opens on hover and keyboard focus, or a tap when asked, and closes on press, unless kept open, or
// Escape
function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  sideOffset,
  delay = 0,
  arrow = true,
  shortcut,
  isKeptOpenOnPress = false,
  isOpenedOnTap = false,
  open,
  defaultOpen,
  onOpenChange,
  disabled = false,
  className,
  onPointerDownOutside,
  ...props
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Whether the tooltip was open as a tap began, null outside one. Radix closes it on the tap's
  // pointerdown, and Android's focus on the tap may open it again, so the tap's click alone decides
  // which way it goes, from what it was before either
  const tapStartedOpenRef = useRef<boolean | null>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false)
  // Whatever React renders is content, a 0 included, so falsiness is not the test
  const hasContent = content !== undefined && content !== null && typeof content !== 'boolean' && content !== ''

  if (disabled || !hasContent) return children

  // Held here rather than by Radix, which has no way to open on a tap, unless the caller holds it
  const isOpen = open ?? uncontrolledOpen

  function handleOpenChange(nextOpen: boolean) {
    setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  // Radix's own handler still runs on a tap, closing an open tooltip, and the tap's click settles it
  function handlePointerDown(event: PointerEvent) {
    if (isOpenedOnTap && event.pointerType === 'touch') {
      tapStartedOpenRef.current = isOpen

      return
    }

    tapStartedOpenRef.current = null

    if (isKeptOpenOnPress) keepOpen(event)
  }

  // A touch the browser took over, as a scroll, ends in no click
  function handlePointerCancel() {
    tapStartedOpenRef.current = null
  }

  function handleClick(event: MouseEvent) {
    const wasOpen = tapStartedOpenRef.current

    tapStartedOpenRef.current = null

    if (wasOpen !== null) {
      keepOpen(event)
      handleOpenChange(!wasOpen)

      return
    }

    if (isKeptOpenOnPress) keepOpen(event)
  }

  // The content dismisses on a press anywhere outside it, the trigger included, which a kept tooltip
  // has to let through, and so does one a tap opens, whose next tap on the trigger closes it
  function handlePointerDownOutside(event: PointerDownOutsideEvent) {
    if (
      (isKeptOpenOnPress || isOpenedOnTap)
      && event.target instanceof Node
      && triggerRef.current?.contains(event.target)
    ) {
      event.preventDefault()
    }

    onPointerDownOutside?.(event)
  }

  // Text has nothing to focus, so its wrapper takes focus itself and the keyboard still reaches it
  const trigger = isValidElement(children) ? (
    children
  ) : (
    <span
      tabIndex={0}
      className="inline-flex rounded-xs align-middle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    >
      {children}
    </span>
  )

  return (
    <TooltipPrimitive.Provider delayDuration={delay}>
      <TooltipPrimitive.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
      >
        <TooltipPrimitive.Trigger
          ref={triggerRef}
          asChild
          onPointerDown={handlePointerDown}
          onPointerCancel={handlePointerCancel}
          onClick={handleClick}
        >
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
            onPointerDownOutside={handlePointerDownOutside}
            className={cn(
              'z-200 box-border w-max max-w-[min(280px,calc(100vw-16px))] rounded-xs border border-border bg-popover px-3 py-1.5 font-sans text-xs leading-[1.4] font-normal text-pretty text-popover-foreground shadow-xs antialiased',
              'animate-in duration-150 ease-out fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-[2px] data-[side=left]:slide-in-from-right-[2px] data-[side=right]:slide-in-from-left-[2px] data-[side=top]:slide-in-from-bottom-[2px]',
              'data-[state=closed]:animate-out data-[state=closed]:duration-100 data-[state=closed]:ease-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              className,
            )}
            {...props}
          >
            {content}
            {shortcut ? (
              <kbd className="ml-2 inline-flex h-4 items-center rounded-xs border border-border bg-neutral-50 px-1 align-[1px] font-mono text-[10px] text-muted-foreground">
                {shortcut}
              </kbd>
            ) : null}
            {arrow ? (
              // The arrow is a square straddling the edge, its inner half hiding the tooltip's
              // border. Radix draws it for the top side and rotates its wrapper for the others,
              // so the two borders on the bottom corner outline every side's arrow
              <TooltipPrimitive.Arrow
                width={ARROW_SIZE}
                height={ARROW_SIZE}
                className="block size-2 -translate-y-1/2 rotate-45 border-r border-b border-border bg-popover fill-transparent"
              />
            ) : null}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

export { Tooltip }
