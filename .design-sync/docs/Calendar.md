A month of days to pick a date from, as a task's due date: the month's name between two arrows,
seven columns of 32px days, today in blue and the picked day filled. It wraps react-day-picker's
`DayPicker`, and brings no padding or border of its own, so it usually sits in a Popover under the
button that shows the date.

## Usage

```jsx
const { Calendar, Popover, PopoverTrigger, PopoverContent, Button } = window.StrategyDanceDesignSystem
const { CalendarIcon } = window.StrategyDanceDesignSystem.Icons

function DueDatePicker() {
  const [date, setDate] = React.useState(new Date(2026, 9, 14))
  const [open, setOpen] = React.useState(false)

  function pick(day) {
    setDate(day)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" icon={<CalendarIcon />}>
          {date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'No due date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" onOpenAutoFocus={event => event.preventDefault()}>
        <Calendar mode="single" selected={date} defaultMonth={date} autoFocus onSelect={pick} />
        <div className="mt-2 flex justify-between gap-2 border-t border-border pt-2">
          <Button variant="transparent" size="sm" onClick={() => pick(new Date())}>Today</Button>
          {date ? (
            <Button variant="transparent" size="sm" onClick={() => pick(undefined)}>Clear</Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

<DueDatePicker />
```

On its own, in French, with the weekends and the days before the 5th out of reach:

```jsx
const { Calendar } = window.StrategyDanceDesignSystem

<div className="w-fit rounded-xs border border-border bg-card p-3">
  <Calendar
    mode="single"
    locale="FR"
    defaultMonth={new Date(2026, 9, 1)}
    selected={new Date(2026, 9, 14)}
    disabled={[{ before: new Date(2026, 9, 5) }, { dayOfWeek: [0, 6] }]}
    onSelect={day => console.log(day)}
  />
</div>
```

## Notes

- Of react-day-picker's many props, a design needs few: `mode`, `selected` and `onSelect` for the
  pick, `defaultMonth`, or `month` with `onMonthChange`, for the month shown, `disabled` for the
  days out of reach, `today` and `autoFocus`. The design system adds `locale`
- `mode="single"` picks one `Date`, and pressing the picked day again clears it to `undefined`
  unless `required`. Without `mode` the calendar only shows. `multiple` fills each picked day the
  same way; a `range` has no look of its own, every day of it filled as a picked day
- 240px wide. Every month draws six weeks, so the calendar keeps its height from one month to the
  next and a popover around it never jumps; the days of the months around it show greyed
- `locale` takes the app's locale code, `EN`, `FR`, `DE`, `ES`, `PT`, `JA` or `ZH` in any case: it
  names the months and days, starts the week on the locale's day and words the arrows. English,
  whose weeks start on Sunday, unless set
- The arrow keys move between days. In a popover, `autoFocus` on the calendar and
  `onOpenAutoFocus={event => event.preventDefault()}` on `PopoverContent` put the focus on the
  picked day, or today, rather than on the first arrow
- Not compound: there are no calendar parts on the global, and `classNames` only replaces the
  design's look
