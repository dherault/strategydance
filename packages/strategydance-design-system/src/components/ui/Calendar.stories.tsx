import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Calendar } from 'strategydance-design-system/components/ui/Calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { Popover, PopoverContent, PopoverTrigger } from 'strategydance-design-system/components/ui/Popover'

const meta = {
  title: 'Components/Calendar',
  component: Calendar,
  args: {
    mode: 'single',
    defaultMonth: new Date(2026, 9, 1),
    selected: new Date(2026, 9, 14),
  },
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Calendar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

// The months and weekdays in French, and the week starting on Monday
export const French: Story = {
  args: {
    locale: 'FR',
  },
}

// A due date's picker, as a task's dialog opens it: the day shown on a button, and the calendar in a
// popover under it, with today and no date a click away
function DatePicker() {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 9, 14))
  const [isOpen, setIsOpen] = useState(true)

  function pick(day: Date | undefined) {
    setDate(day)
    setIsOpen(false)
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <PopoverTrigger asChild>
        <Button variant="outline">
          {date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'No date'}
        </Button>
      </PopoverTrigger>
      {/* The calendar focuses the day picked, or today, where the popover would focus the first arrow */}
      <PopoverContent
        className="w-auto p-3"
        onOpenAutoFocus={event => event.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          autoFocus
          onSelect={pick}
        />
        <div className="mt-2 flex justify-between gap-2 border-t border-border pt-2">
          <Button
            variant="transparent"
            size="sm"
            onClick={() => pick(new Date())}
          >
            Today
          </Button>
          {date ? (
            <Button
              variant="transparent"
              size="sm"
              onClick={() => pick(undefined)}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export const InPopover: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      story: {
        height: '420px',
      },
    },
  },
  render: () => <DatePicker />,
}

// Inside a modal dialog, which a popover from Radix layers above
export const InDialog: Story = {
  parameters: {
    docs: {
      story: {
        height: '520px',
      },
    },
  },
  render: () => (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record the demo video</DialogTitle>
          <DialogDescription>Complete by</DialogDescription>
        </DialogHeader>
        <DatePicker />
      </DialogContent>
    </Dialog>
  ),
}
