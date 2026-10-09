import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Calendar } from 'strategydance-design-system/components/ui/Calendar'
import { Popover, PopoverContent, PopoverTrigger } from 'strategydance-design-system/components/ui/Popover'
import { cn } from 'strategydance-design-system/lib/utils'

import useFormatTaskDueDate from '~hooks/task/useFormatTaskDueDate'

import fromPickerDate from '~utils/date/fromPickerDate'
import toPickerDate from '~utils/date/toPickerDate'

import { TASK_EDITABLE_CLASS_NAME } from '~components/task/taskClassNames'

import taskMessages from '~data/intl/messages/task'

type Props = {
  value: string | null
  isLate: boolean
  today: string
  onChange: (dueDate: string | null) => void
}

/*
  The day a task should be done by, in full, red and saying so once it is overdue, which opens a
  calendar to pick another, with today and no date a click away. The calendar focuses the day
  picked, or today, so the arrow keys move from there
*/
function TaskDueDateField({ value, isLate, today, onChange }: Props) {
  const { formatMessage, locale } = useIntl()
  const formatTaskDueDate = useFormatTaskDueDate()
  const [isOpen, setIsOpen] = useState(false)

  function pick(dueDate: string | null) {
    if (dueDate !== value) onChange(dueDate)

    setIsOpen(false)
  }

  const label = value ? formatTaskDueDate(value, 'long') : formatMessage(taskMessages.noDate)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{formatMessage(taskMessages.completeBy)}</span>
      <Popover
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title={formatMessage(taskMessages.changeDate)}
            className={cn(
              TASK_EDITABLE_CLASS_NAME,
              'text-sm',
              !value && 'text-muted-foreground',
              isLate && 'font-medium text-red-600',
            )}
          >
            {isLate ? formatMessage(taskMessages.overdue, { date: label }) : label}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto p-3"
          onOpenAutoFocus={event => event.preventDefault()}
        >
          <Calendar
            mode="single"
            selected={value ? toPickerDate(value) : undefined}
            defaultMonth={toPickerDate(value ?? today)}
            today={toPickerDate(today)}
            locale={locale}
            autoFocus
            onSelect={date => pick(date ? fromPickerDate(date) : value)}
          />
          <div className="mt-2 flex justify-between gap-2 border-t border-border pt-2">
            <Button
              variant="transparent"
              size="sm"
              onClick={() => pick(today)}
            >
              {formatMessage(taskMessages.dueToday)}
            </Button>
            {value ? (
              <Button
                variant="transparent"
                size="sm"
                onClick={() => pick(null)}
              >
                {formatMessage(taskMessages.clearDate)}
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default TaskDueDateField
