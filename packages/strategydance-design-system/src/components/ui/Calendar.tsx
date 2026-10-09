import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'
import { getCalendarLocale } from 'strategydance-design-system/lib/getCalendarLocale'
import { cn } from 'strategydance-design-system/lib/utils'

// DayPicker's props, each selection mode's own, with the locale left to `Calendar`
type DayPickerProps<Props = ComponentProps<typeof DayPicker>> = Props extends unknown ? Omit<Props, 'locale'> : never

type Props = DayPickerProps & {
  /**
   * The app's locale code, such as 'FR', which names the months and days, says which day a week
   * starts on and words the buttons, in English where it cannot
   */
  locale?: string
}

/*
  shadcn's calendar, on react-day-picker, in the design's picker: a month of 32px days in seven
  columns under its name and the arrows to the months around it, the days of the months around it
  greyed, today in the primary color and bold, and the day picked filled with it. It brings no
  padding or border of its own, so it sits in a popover's.

  Every month takes six weeks, as the design's 42 days do, so the calendar keeps its height from one
  month to the next and a popover around it never jumps to the other side of its field

  The arrow keys move between days, as DayPicker's grid does, and the focus follows them
*/
function Calendar({ className, classNames, showOutsideDays = true, fixedWeeks = true, locale, ...props }: Props) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      locale={getCalendarLocale(locale)}
      className={cn('w-60 font-sans', className)}
      classNames={{
        root: cn('relative', defaultClassNames.root),
        months: cn('flex flex-col', defaultClassNames.months),
        month: cn('flex flex-col gap-2', defaultClassNames.month),
        nav: cn('absolute inset-x-0 top-0 flex items-center justify-between', defaultClassNames.nav),
        button_previous: cn(
          buttonVariants({ variant: 'transparent', size: 'sm' }),
          'w-8 px-0 text-base aria-disabled:opacity-50',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: 'transparent', size: 'sm' }),
          'w-8 px-0 text-base aria-disabled:opacity-50',
          defaultClassNames.button_next,
        ),
        month_caption: cn('flex h-8 items-center justify-center px-8', defaultClassNames.month_caption),
        caption_label: cn('text-sm font-semibold text-secondary select-none', defaultClassNames.caption_label),
        month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
        weekdays: cn('grid grid-cols-7 gap-0.5', defaultClassNames.weekdays),
        weekday: cn(
          'flex h-7 items-center justify-center text-xs font-medium text-muted-foreground select-none',
          defaultClassNames.weekday,
        ),
        weeks: cn('flex flex-col gap-0.5', defaultClassNames.weeks),
        week: cn('grid grid-cols-7 gap-0.5', defaultClassNames.week),
        day: cn('p-0 text-center', defaultClassNames.day),
        day_button: cn(
          'flex h-8 w-full cursor-pointer items-center justify-center rounded-xs text-sm text-foreground tabular-nums transition-colors duration-150 ease-in-out outline-none hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-secondary',
          defaultClassNames.day_button,
        ),
        today: cn('[&>button]:font-semibold [&>button]:text-primary', defaultClassNames.today),
        outside: cn('[&>button]:text-neutral-400', defaultClassNames.outside),
        selected: cn(
          '[&>button]:bg-primary [&>button]:font-medium [&>button]:text-white [&>button]:hover:bg-primary-800',
          defaultClassNames.selected,
        ),
        disabled: cn('[&>button]:cursor-not-allowed [&>button]:opacity-50', defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? <ChevronLeftIcon aria-hidden="true" /> : <ChevronRightIcon aria-hidden="true" />,
      }}
      {...props}
    />
  )
}

export { Calendar }
