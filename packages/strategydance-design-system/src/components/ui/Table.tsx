import type { ComponentProps } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

type Align = 'left' | 'center' | 'right'

// Right-aligned columns hold figures, so their digits line up
const alignClassNames: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right tabular-nums',
}

type TableProps = ComponentProps<'table'> & {
  /** Row height: `sm` is 40px, `md` 48px */
  density?: 'sm' | 'md'
  /** Fills every other body row */
  striped?: boolean
  /** A neutral-200 frame with the xs radius around the scroll container */
  bordered?: boolean
  /** For the horizontal scroll wrapper */
  containerClassName?: string
}

/*
  The shadcn anatomy: a scroll wrapper, then Header, Body, Footer, Row, Head, Cell and Caption.

  Density and striping are set once here and read by the rows and cells below through the named
  `table` group, so a cell never has to be told which table it sits in
*/
function Table({ density = 'md', striped = false, bordered = true, containerClassName, className, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        'relative w-full overflow-x-auto bg-white font-sans antialiased',
        bordered && 'rounded-xs border border-border',
        containerClassName,
      )}
    >
      <table
        data-slot="table"
        data-density={density}
        data-striped={striped}
        className={cn('group/table w-full caption-bottom border-collapse text-sm leading-[1.43] text-foreground', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&>tr]:bg-neutral-50', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&>tr:last-child]:border-b-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t border-border bg-neutral-50 font-medium text-secondary [&>tr]:border-b-0', className)}
      {...props}
    />
  )
}

type TableRowProps = ComponentProps<'tr'> & {
  selected?: boolean
}

/*
  Only body rows answer the pointer, which `in-[tbody]` scopes without the row having to know
  where it is. A selected row keeps its fill over the stripe and the hover alike, which the
  design's own stylesheet let the stripe win
*/
function TableRow({ selected = false, className, ...props }: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      data-state={selected ? 'selected' : undefined}
      aria-selected={selected ? true : undefined}
      className={cn(
        'border-b border-border transition-colors duration-150 ease-in-out',
        'in-[tbody]:hover:bg-neutral-50',
        'group-data-[striped=true]/table:in-[tbody]:even:bg-neutral-50 group-data-[striped=true]/table:in-[tbody]:hover:bg-neutral-100',
        'data-[state=selected]:bg-primary-50!',
        className,
      )}
      {...props}
    />
  )
}

type TableCellProps<T extends 'th' | 'td'> = ComponentProps<T> & {
  align?: Align
}

// A column of checkboxes is as narrow as its checkbox
const checkboxCellClassName = 'has-data-[slot=checkbox]:w-4 has-data-[slot=checkbox]:pr-0'

function TableHead({ align, className, ...props }: TableCellProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-10 px-4 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground',
        'group-data-[density=sm]/table:h-9 group-data-[density=sm]/table:px-3',
        checkboxCellClassName,
        align && alignClassNames[align],
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ align, className, ...props }: TableCellProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'box-border h-12 px-4 py-2 align-middle',
        'group-data-[density=sm]/table:h-10 group-data-[density=sm]/table:px-3 group-data-[density=sm]/table:py-1.5',
        checkboxCellClassName,
        align && alignClassNames[align],
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('border-t border-border px-4 py-3 text-left text-xs text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
}
