import { Popover as PopoverPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

/*
  shadcn's popover in the design's overlay: white, a neutral-200 border, the xs radius and the `md`
  shadow, as the dropdown menu's content. For interactive content anchored to a trigger, like a
  picker, where a tooltip would close under the pointer. Closes on an outside click and on Escape,
  and returns focus to its trigger
*/
function Popover(props: ComponentProps<typeof PopoverPrimitive.Root>) {
  return (
    <PopoverPrimitive.Root
      data-slot="popover"
      {...props}
    />
  )
}

function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      {...props}
    />
  )
}

// Positions against something other than the trigger, like a whole field around it
function PopoverAnchor(props: ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return (
    <PopoverPrimitive.Anchor
      data-slot="popover-anchor"
      {...props}
    />
  )
}

// Padded by default; a picker that brings its own layout passes `p-0`
function PopoverContent({
  align = 'start',
  sideOffset = 4,
  className,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-xs border border-border bg-popover p-4 font-sans text-popover-foreground shadow-md outline-none duration-150 ease-out data-[side=bottom]:slide-in-from-top-[2px] data-[side=left]:slide-in-from-right-[2px] data-[side=right]:slide-in-from-left-[2px] data-[side=top]:slide-in-from-bottom-[2px] data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
}
