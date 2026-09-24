import { type VariantProps, cva } from 'class-variance-authority'
import { Tabs as TabsPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

import { pillVariants } from 'strategydance-design-system/components/ui/Pill'

/*
  The underline grows from the centre on hover, and stays on the active tab. Leaving a tab, it
  shrinks while still primary and only then turns grey, hence the delayed colour transition.
  It transitions `scale` rather than the design's `transform`, because that is the property
  Tailwind's `scale-x-*` sets
*/
const tabVariants = cva(
  'group relative inline-flex flex-none cursor-pointer items-center justify-center gap-2 border-0 bg-transparent px-0.5 leading-none font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 ease-in-out after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:scale-x-0 after:bg-neutral-300 after:[transition:scale_200ms_var(--ease-out),background-color_0s_linear_200ms] enabled:hover:after:scale-x-100 enabled:hover:not-data-[state=active]:text-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:text-primary data-[state=active]:after:scale-x-100 data-[state=active]:after:bg-primary data-[state=active]:after:[transition:scale_200ms_var(--ease-out),background-color_150ms_var(--ease-in-out)] motion-reduce:after:transition-none [&_svg]:shrink-0',
  {
    variants: {
      size: {
        sm: 'h-8 text-xs [&_svg]:size-3.5',
        md: 'h-10 text-sm [&_svg]:size-4',
      },
      fullWidth: {
        true: 'flex-1',
        false: '',
      },
    },
    defaultVariants: {
      size: 'md',
      fullWidth: false,
    },
  },
)

type TabItem = {
  value: string
  label: ReactNode
  /** Before the label: 16px, or 14px at `sm` */
  icon?: ReactNode
  /** A neutral count pill after the label, tinted primary on the active tab */
  count?: number | string
  disabled?: boolean
  /** The panel. Leave it out on every item to render the tab list alone, for routing */
  content?: ReactNode
}

type Props = Omit<ComponentProps<typeof TabsPrimitive.Root>, 'value' | 'defaultValue' | 'onValueChange' | 'children'> & VariantProps<typeof tabVariants> & {
  items: TabItem[]
  value?: string
  /** Defaults to the first enabled item */
  defaultValue?: string
  onValueChange?: (value: string) => void
  'aria-label'?: string
}

// Switches between related views of the same context. Arrow keys, Home and End move the selection
function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  size = 'md',
  fullWidth = false,
  'aria-label': ariaLabel,
  className,
  ...props
}: Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      value={value}
      defaultValue={defaultValue ?? items.find(item => !item.disabled)?.value}
      onValueChange={onValueChange}
      className={cn('flex flex-col gap-4 font-sans text-foreground antialiased', className)}
      {...props}
    >
      <TabsPrimitive.List
        aria-label={ariaLabel}
        className={cn('flex min-w-0 items-stretch gap-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)] scrollbar-none [&::-webkit-scrollbar]:hidden', fullWidth && 'self-stretch')}
      >
        {items.map(item => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={tabVariants({ size, fullWidth })}
          >
            {item.icon}
            <span>
              {item.label}
            </span>
            {item.count !== undefined && item.count !== null
              ? (
                  <span className={cn(pillVariants({ variant: 'neutral', size: 'sm' }), 'group-data-[state=active]:bg-primary-100 group-data-[state=active]:text-primary-800')}>
                    {item.count}
                  </span>
                )
              : null}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map(item => item.content === undefined
        ? null
        : (
            <TabsPrimitive.Content
              key={item.value}
              value={item.value}
              className="text-sm leading-normal outline-none focus-visible:rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            >
              {item.content}
            </TabsPrimitive.Content>
          ))}
    </TabsPrimitive.Root>
  )
}

export { Tabs }
export type { TabItem }
