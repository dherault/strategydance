import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Calendar } from 'strategydance-design-system/components/ui/Calendar'
import { inputClassName } from 'strategydance-design-system/components/ui/Input'
import { Popover, PopoverContent, PopoverTrigger } from 'strategydance-design-system/components/ui/Popover'
import { cn } from 'strategydance-design-system/lib/utils'

import formatBudgetDay from '~utils/budget/formatBudgetDay'
import fromPickerDate from '~utils/date/fromPickerDate'
import toPickerDate from '~utils/date/toPickerDate'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  // The control's id, which its label points at
  id: string
  value: string | null
  today: string
  // The first and last days it offers, the others drawn disabled
  from: string
  to: string
  // Whether it may be emptied, as an end is: Clear then sits beside Today
  isClearable?: boolean
  isInvalid?: boolean
  describedBy?: string
  onChange: (day: string | null) => void
  onBlur?: () => void
}

/*
  A day of a bill, its payment's or its end's, as a field that opens the calendar the task's due
  date opens, Today and, where the field may be empty, Clear a click away. The day shows with its
  year whatever the year, since a bill is often months old. The calendar focuses the day picked,
  or today, so the arrow keys move from there
*/
function BillDayField({
  id,
  value,
  today,
  from,
  to,
  isClearable = false,
  isInvalid = false,
  describedBy,
  onChange,
  onBlur,
}: Props) {
  const { formatMessage, locale } = useIntl()
  const [isOpen, setIsOpen] = useState(false)

  const isTodayOffered = from <= today && today <= to

  function pick(day: string | null) {
    if (day !== value) onChange(day)

    setIsOpen(false)
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={nextIsOpen => {
        setIsOpen(nextIsOpen)

        if (!nextIsOpen) onBlur?.()
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            inputClassName,
            'flex items-center justify-between gap-2 text-left',
            !value && 'text-muted-foreground',
          )}
        >
          <span className="truncate">
            {value ? formatBudgetDay(value, today, locale, { withYear: true }) : formatMessage(budgetMessages.pickDay)}
          </span>
          <CalendarIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-neutral-500"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="w-auto p-3"
        onOpenAutoFocus={event => event.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={value ? toPickerDate(value) : undefined}
          defaultMonth={toPickerDate(value ?? (isTodayOffered ? today : from))}
          today={toPickerDate(today)}
          startMonth={toPickerDate(from)}
          endMonth={toPickerDate(to)}
          disabled={[{ before: toPickerDate(from) }, { after: toPickerDate(to) }]}
          locale={locale}
          autoFocus
          onSelect={date => pick(date ? fromPickerDate(date) : value)}
        />
        <div className="mt-2 flex justify-between gap-2 border-t border-border pt-2">
          {isTodayOffered ? (
            <Button
              variant="transparent"
              size="sm"
              onClick={() => pick(today)}
            >
              {formatMessage(budgetMessages.today)}
            </Button>
          ) : (
            <span />
          )}
          {isClearable && value ? (
            <Button
              variant="transparent"
              size="sm"
              onClick={() => pick(null)}
            >
              {formatMessage(budgetMessages.clearDay)}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default BillDayField
