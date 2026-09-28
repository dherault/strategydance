import { CheckIcon, ChevronDownIcon, LockIcon, LockOpenIcon, PlusIcon } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Popover, PopoverContent, PopoverTrigger } from 'strategydance-design-system/components/ui/Popover'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import { cn } from 'strategydance-design-system/lib/utils'

import type { ChecklistItem } from '~types'

import useChecklist from '~hooks/checklist/useChecklist'
import useChecklistHistory from '~hooks/checklist/useChecklistHistory'
import useDragReorder from '~hooks/common/useDragReorder'
import useLocalDate from '~hooks/common/useLocalDate'

import createId from '~utils/common/createId'
import addDays from '~utils/date/addDays'
import getDaysBetween from '~utils/date/getDaysBetween'
import getLocalDate from '~utils/date/getLocalDate'
import toCalendarDate from '~utils/date/toCalendarDate'

import ChecklistItemForm from '~components/checklist/ChecklistItemForm'
import Spinner from '~components/common/Spinner'
import TodaySectionLoadFailed from '~components/today/TodaySectionLoadFailed'

import checklistMessages from '~data/intl/messages/checklist'

// The days the table shows folded, today first
const COLLAPSED_DAYS = 7

// How far a column's name leans back from the horizontal, and the header's least height
const LABEL_ANGLE_DEGREES = 62
const MIN_HEADER_HEIGHT = 96

const LABEL_CLASS_NAME = 'absolute bottom-0.5 left-[calc(50%-10px)] block h-6 w-max origin-bottom-left rotate-[-62deg] rounded-xs border-0 bg-transparent px-1.5 text-left font-sans text-[13px] leading-6 font-medium whitespace-nowrap text-secondary'
const ITEM_CELL_CLASS_NAME = 'w-14 min-w-14 max-w-14'
const DAY_CELL_CLASS_NAME = 'sticky left-0 w-44 min-w-44 border-r border-neutral-200 bg-white'
const BOX_CLASS_NAME = 'flex h-10 w-full items-center justify-center text-primary [&_svg]:size-[18px]'

type Props = {
  userId: string
  // The reader's own checklist, which they tick and arrange. Anybody else's is read only
  isOwn: boolean
}

/*
  A member's checklist as a table: a row a day, today on top, and a column a habit, its name
  leaning over it. Folded it shows the last week; unfolded, every day back to when it started,
  which reads the rest of its history then.

  On the reader's own, today's row is open to tick, and each earlier day has a lock that opens it,
  for a day they forgot. A column's name opens a popover to rename, move or remove it, and drags to
  reorder. A teammate's reads the same, locked, in their time zone.

  The header is as tall as the longest name needs once slanted, measured after each rename
*/
function ChecklistTable({ userId, isOwn }: Props) {
  const { formatMessage, formatDate } = useIntl()
  const { data: checklist, initialLoading, hasFailed, loading, refetch, createItem, updateItem, deleteItem, restoreItem, moveItem, setChecked } = useChecklist(userId)

  const [isExpanded, setIsExpanded] = useState(false)
  const [unlockedDays, setUnlockedDays] = useState<Set<string>>(() => new Set())
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [headerHeight, setHeaderHeight] = useState(136)
  const headRef = useRef<HTMLTableSectionElement>(null)

  const { data: history, isLoading: isHistoryLoading, hasFailed: hasHistoryFailed } = useChecklistHistory(userId, isExpanded)

  const owner = checklist.owner[0] ?? null
  const timeZone = isOwn ? undefined : owner?.user.timezone
  const today = useLocalDate(timeZone)
  const items = checklist.checklistItems

  const { draggedIndex, getItemProps, getDropSide } = useDragReorder({
    keys: items.map(({ id }) => id),
    axis: 'horizontal',
    isHandleArmed: false,
    onMove: (from, to) => report(moveItem(from, to)),
  })

  // The table starts on the day they joined, or on their oldest tick when that is older, as it is
  // for somebody who left and was invited again
  const joinedOn = owner ? getLocalDate(new Date(owner.createdAt), timeZone) : today
  const startsOn = [joinedOn, checklist.earliest[0]?.date ?? today, today].sort()[0]!
  const dayCount = getDaysBetween(startsOn, today) + 1
  const canExpand = dayCount > COLLAPSED_DAYS
  const isShowingAll = isExpanded && history !== null
  const days = Array.from({ length: isShowingAll ? dayCount : Math.min(COLLAPSED_DAYS, dayCount) }, (_, index) => addDays(today, -index))
  const currentYear = today.slice(0, 4)

  // Every day each column was ticked that the page has read: the week, and the history once unfolded
  const ticks = new Map(items.map(item => [item.id, new Set(item.completions.map(({ date }) => date))]))

  for (const item of history ?? []) {
    const itemTicks = ticks.get(item.id)

    for (const { date } of item.completions) itemTicks?.add(date)
  }

  const namesKey = items.map(({ name }) => name).join('\n')

  useLayoutEffect(() => {
    const labels = headRef.current ? [...headRef.current.querySelectorAll<HTMLElement>('[data-checklist-label]')] : []
    const widest = Math.max(0, ...labels.map(label => label.offsetWidth))

    setHeaderHeight(Math.max(MIN_HEADER_HEIGHT, Math.ceil(widest * Math.sin(LABEL_ANGLE_DEGREES * Math.PI / 180) + 32)))
  }, [namesKey])

  async function report(write: Promise<void>) {
    try {
      await write
    }
    catch (error) {
      console.error('Failed to save a change to the checklist', error)

      toast.error(formatMessage(checklistMessages.saveError))
    }
  }

  function formatDay(date: string) {
    return formatDate(toCalendarDate(date), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.startsWith(currentYear) ? undefined : 'numeric',
      timeZone: 'UTC',
    })
  }

  function toggleLock(date: string) {
    setUnlockedDays(current => {
      const next = new Set(current)

      if (next.has(date)) next.delete(date)
      else next.add(date)

      return next
    })
  }

  function add() {
    const id = createId()

    report(createItem(id, formatMessage(checklistMessages.newItemName)))
    setEditingItemId(id)
  }

  function remove(item: ChecklistItem, index: number) {
    setEditingItemId(null)
    report(deleteItem(item))
    toast(formatMessage(checklistMessages.removed, { name: item.name }), {
      action: {
        label: formatMessage(checklistMessages.undo),
        onClick: () => report(restoreItem(item, index)),
      },
    })
  }

  // Where a dragged column would land, drawn on its header and every cell under it
  function getColumnProps(index: number) {
    const { onDragOver, onDrop } = getItemProps(index)
    const dropSide = getDropSide(index)

    return {
      onDragOver,
      onDrop,
      className: cn(
        dropSide === 'before' && 'shadow-[inset_2px_0_0_var(--color-primary)]',
        dropSide === 'after' && 'shadow-[inset_-2px_0_0_var(--color-primary)]',
      ),
    }
  }

  if (initialLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xs border border-neutral-200 bg-white">
        <Spinner />
      </div>
    )
  }

  if (hasFailed) {
    return (
      <TodaySectionLoadFailed
        message={formatMessage(checklistMessages.loadError)}
        isRetrying={loading}
        onRetry={refetch}
      />
    )
  }

  if (!isOwn && !items.length) {
    return (
      <p className="m-0 rounded-xs border border-dashed border-neutral-300 p-6 text-sm text-muted-foreground">
        {formatMessage(checklistMessages.noItems)}
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xs border border-neutral-200 bg-white">
      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full border-separate border-spacing-0 font-sans text-sm text-foreground">
          <thead ref={headRef}>
            <tr style={{ height: headerHeight }}>
              <th
                scope="col"
                className={cn(DAY_CELL_CLASS_NAME, 'z-3 border-b px-4 pb-3 text-left align-bottom text-xs font-medium text-muted-foreground')}
              >
                {formatMessage(checklistMessages.day)}
              </th>
              {items.map((item, index) => {
                const { className: columnClassName, ...columnProps } = getColumnProps(index)
                const { draggable, onDragStart, onDragEnd } = getItemProps(index)

                return (
                  <th
                    key={item.id}
                    scope="col"
                    className={cn(ITEM_CELL_CLASS_NAME, 'relative border-b border-neutral-200 p-0 align-bottom', draggedIndex === index && '[&_[data-checklist-label]]:opacity-40', columnClassName)}
                    {...columnProps}
                  >
                    {isOwn
                      ? (
                          <Popover
                            open={editingItemId === item.id}
                            onOpenChange={isOpen => setEditingItemId(isOpen ? item.id : null)}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                data-checklist-label
                                title={formatMessage(checklistMessages.itemHint, { name: item.name })}
                                draggable={draggable}
                                onDragStart={event => {
                                  setEditingItemId(null)
                                  onDragStart(event)
                                }}
                                onDragEnd={onDragEnd}
                                className={cn(
                                  LABEL_CLASS_NAME,
                                  'cursor-pointer transition-colors duration-150 ease-in-out hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-secondary active:cursor-grabbing',
                                  editingItemId === item.id && 'bg-primary-50 text-primary hover:bg-primary-50',
                                )}
                              >
                                {item.name}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              aria-label={formatMessage(checklistMessages.editItem, { name: item.name })}
                              className="w-68 p-3"
                            >
                              <ChecklistItemForm
                                name={item.name}
                                canMoveLeft={index > 0}
                                canMoveRight={index < items.length - 1}
                                canRemove={items.length > 1}
                                onRename={name => {
                                  setEditingItemId(null)

                                  if (name !== item.name) report(updateItem({ ...item, name }))
                                }}
                                onMove={direction => report(moveItem(index, index + direction))}
                                onRemove={() => remove(item, index)}
                              />
                            </PopoverContent>
                          </Popover>
                        )
                      : (
                          <span
                            data-checklist-label
                            title={item.name}
                            className={LABEL_CLASS_NAME}
                          >
                            {item.name}
                          </span>
                        )}
                  </th>
                )
              })}
              <th className="w-12 min-w-12 border-b border-neutral-200 px-2 pb-2 text-center align-bottom">
                {isOwn
                  ? (
                      <Button
                        variant="transparent"
                        size="sm"
                        icon={<PlusIcon />}
                        aria-label={formatMessage(checklistMessages.addItem)}
                        title={formatMessage(checklistMessages.addItem)}
                        onClick={add}
                      />
                    )
                  : null}
              </th>
              <th
                aria-hidden="true"
                className="w-full min-w-24 border-b border-neutral-200"
              />
            </tr>
          </thead>
          <tbody>
            {days.map(date => {
              const isToday = date === today
              const isUnlocked = unlockedDays.has(date)
              const isOpen = isOwn && (isToday || isUnlocked)
              const day = formatDay(date)

              return (
                <tr
                  key={date}
                  className="[&:last-child>*]:border-b-0 [&>*]:border-b [&>*]:border-neutral-100"
                >
                  <th
                    scope="row"
                    className={cn(DAY_CELL_CLASS_NAME, 'z-1 h-10 px-4 text-left whitespace-nowrap', isToday ? 'font-medium text-secondary' : 'font-normal')}
                  >
                    <span className="flex items-center gap-2">
                      {day}
                      {isToday
                        ? (
                            <Badge
                              size="sm"
                              variant="primary"
                            >
                              {formatMessage(checklistMessages.today)}
                            </Badge>
                          )
                        : null}
                    </span>
                  </th>
                  {items.map((item, index) => {
                    const isChecked = ticks.get(item.id)?.has(date) ?? false
                    const { className: columnClassName, ...columnProps } = getColumnProps(index)

                    return (
                      <td
                        key={item.id}
                        className={cn(ITEM_CELL_CLASS_NAME, 'border-l border-neutral-100 p-0', isOpen ? 'bg-primary-50' : 'bg-white', columnClassName)}
                        {...columnProps}
                      >
                        {isOpen
                          ? (
                              <button
                                type="button"
                                aria-pressed={isChecked}
                                aria-label={formatMessage(checklistMessages.cell, { name: item.name, day })}
                                className={cn(BOX_CLASS_NAME, 'cursor-pointer border-0 bg-transparent p-0 transition-colors duration-150 ease-in-out hover:bg-primary-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary')}
                                onClick={() => report(setChecked(item.id, date, !isChecked))}
                              >
                                {isChecked ? <CheckIcon aria-hidden="true" /> : null}
                              </button>
                            )
                          : (
                              <span
                                role="img"
                                aria-label={formatMessage(isChecked ? checklistMessages.cellDone : checklistMessages.cellNotDone, { name: item.name, day })}
                                className={BOX_CLASS_NAME}
                              >
                                {isChecked ? <CheckIcon aria-hidden="true" /> : null}
                              </span>
                            )}
                      </td>
                    )
                  })}
                  <td className="w-12 min-w-12 border-l border-neutral-100 px-2 text-center">
                    {isOwn && !isToday
                      ? (
                          <Button
                            variant="transparent"
                            size="sm"
                            icon={isUnlocked ? <LockOpenIcon /> : <LockIcon />}
                            aria-pressed={isUnlocked}
                            aria-label={formatMessage(isUnlocked ? checklistMessages.lockDay : checklistMessages.unlockDay, { day })}
                            title={formatMessage(isUnlocked ? checklistMessages.lockHint : checklistMessages.unlockHint)}
                            className={isUnlocked ? 'text-primary' : 'text-neutral-400 not-disabled:hover:text-neutral-700'}
                            onClick={() => toggleLock(date)}
                          />
                        )
                      : null}
                  </td>
                  <td
                    aria-hidden="true"
                    className="w-full min-w-24"
                  />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {canExpand
        ? (
            <div className="flex flex-col items-center gap-1 border-t border-neutral-200 p-1">
              <Button
                variant="transparent"
                size="sm"
                aria-expanded={isShowingAll}
                disabled={isHistoryLoading}
                icon={isHistoryLoading
                  ? <Spinner tone="current" />
                  : <ChevronDownIcon className={cn('transition-transform duration-150 ease-in-out', isShowingAll && 'rotate-180')} />}
                onClick={() => setIsExpanded(current => !current)}
              >
                {formatMessage(isShowingAll ? checklistMessages.showLess : checklistMessages.showAll, { count: dayCount })}
              </Button>
              {isExpanded && hasHistoryFailed
                ? (
                    <p className="m-0 pb-2 text-sm text-danger">
                      {formatMessage(checklistMessages.historyError)}
                    </p>
                  )
                : null}
            </div>
          )
        : null}
    </div>
  )
}

export default ChecklistTable
