import { type VariantProps, cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

const emptyVariants = cva(
  'group/empty box-border flex w-full min-w-0 flex-col items-center justify-center rounded-xs border border-dashed border-neutral-200 text-center font-sans text-balance antialiased',
  {
    variants: {
      size: {
        default: 'gap-3 px-6 py-14',
        sm: 'gap-2.5 px-6 py-8',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

/*
  What a list shows where it has nothing yet: a picture, a title, a line on what would be there, and
  the button that adds the first. shadcn's empty state, in a dashed frame. `sm` is a section's, on a
  page with more going on than the list
*/
function Empty({ size = 'default', className, ...props }: ComponentProps<'div'> & VariantProps<typeof emptyVariants>) {
  return (
    <div
      data-slot="empty"
      data-size={size}
      className={cn(emptyVariants({ size }), className)}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-header"
      className={cn('flex max-w-[44ch] flex-col items-center gap-3 group-data-[size=sm]/empty:gap-2.5', className)}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  'flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: 'size-10 rounded-xs bg-neutral-100 text-neutral-600 group-data-[size=sm]/empty:size-8 [&_svg:not([class*=size-])]:size-4',
      },
    },
    defaultVariants: {
      variant: 'icon',
    },
  },
)

// The picture over the title: an icon on a tile unless `variant` says otherwise
function EmptyMedia({
  variant = 'icon',
  className,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-media"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant }), className)}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="empty-title"
      className={cn('m-0 text-base leading-[1.4] font-semibold text-secondary', className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="empty-description"
      className={cn('m-0 text-sm leading-normal text-pretty text-muted-foreground', className)}
      {...props}
    />
  )
}

// The buttons under the text, meant to be small Buttons
function EmptyContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-content"
      className={cn('mt-1 flex flex-wrap items-center justify-center gap-2', className)}
      {...props}
    />
  )
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle }
