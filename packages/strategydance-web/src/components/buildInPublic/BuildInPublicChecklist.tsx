import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useChecklist from '~hooks/checklist/useChecklist'
import useRecentChecklistTicks from '~hooks/checklist/useRecentChecklistTicks'
import useLocalDate from '~hooks/common/useLocalDate'

import formatCardDay from '~utils/buildInPublic/formatCardDay'
import getChecklistGrid from '~utils/buildInPublic/getChecklistGrid'
import getDaysBetween from '~utils/date/getDaysBetween'
import getLocalDate from '~utils/date/getLocalDate'
import toCalendarDate from '~utils/date/toCalendarDate'

import BuildInPublicBar from '~components/buildInPublic/BuildInPublicBar'
import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import BuildInPublicCheckbox from '~components/buildInPublic/BuildInPublicCheckbox'
import BuildInPublicSection from '~components/buildInPublic/BuildInPublicSection'
import {
  CARD_DISPLAY_CLASS_NAME,
  CARD_EYEBROW_CLASS_NAME,
  CARD_MUTED_CLASS_NAME,
} from '~components/buildInPublic/cardClassNames'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

// How far back the cards look, or since the reader joined when that is sooner
const CHECKLIST_WINDOW_DAYS = 30

// The day counts the grid offers, besides the whole window
const GRID_DAY_COUNTS = [7, 14, 21, 30]

// The most items each card has room for
const MAX_GRID_ITEMS = 4
const MAX_CONSISTENCY_ITEMS = 5
const MAX_DAILY_LIST_ITEMS = 5

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
}

/*
  The checklist cards, from the reader's own checklist over the last month, or since they joined,
  with each item's run counted back through the last year: a grid of each item's days, one item's
  run with the ticks of every day, how often each item was kept, and one day's list. The section is
  left out while the checklist has no item
*/
function BuildInPublicChecklist({ settings }: Props) {
  const { formatMessage, formatDate, formatNumber } = useIntl()
  const { data: viewer } = useAuthentication()
  const viewerId = viewer?.uid ?? null
  const { data: checklist, loading, refetch, hasFailed } = useChecklist(viewerId)
  const {
    data: recentTicks,
    loading: areTicksLoading,
    refetch: refetchTicks,
    hasFailed: haveTicksFailed,
  } = useRecentChecklistTicks()
  const today = useLocalDate()

  const items = checklist.checklistItems

  if (!hasFailed && !haveTicksFailed && !items.length) return null

  const owner = checklist.owner[0] ?? null
  const joinedOn = owner ? getLocalDate(new Date(owner.createdAt)) : today
  const days = Math.max(1, Math.min(CHECKLIST_WINDOW_DAYS, getDaysBetween(joinedOn, today) + 1))
  // Every tick of the last year, with the last week's the checklist holds, which a tick made since
  // the year was read is in
  const ticks = new Map(items.map(item => [item.id, new Set(item.completions.map(completion => completion.date))]))

  for (const item of recentTicks) {
    for (const completion of item.completions) ticks.get(item.id)?.add(completion.date)
  }

  const grid = getChecklistGrid(items, ticks, today, days)
  const itemIds = items.map(item => item.id)
  const itemOptions = items.map(item => ({ value: item.id, label: item.name }))
  const isMultiple = items.length > 1

  // The items picked that are still there, in the checklist's order, or the first ones when none is
  function pickItems(ids: string[], max: number) {
    const picked = grid.perItem.filter(item => ids.includes(item.id))

    return (picked.length ? picked : grid.perItem).slice(0, max)
  }

  function itemsField(max: number): CardField {
    return {
      kind: 'multiSelect',
      key: 'items',
      label: formatMessage(buildInPublicMessages.checklistItems),
      options: itemOptions,
      max,
    }
  }

  function formatDay(date: string, isToday: boolean) {
    return isToday
      ? formatMessage(buildInPublicMessages.today)
      : formatDate(toCalendarDate(date), { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
  }

  const dayCounts = [...new Set([...GRID_DAY_COUNTS, days])].filter(count => count <= days).sort((a, b) => a - b)
  const gridValues = settings.readCard('checklist-grid', {
    days: String(days),
    items: itemIds.slice(0, MAX_GRID_ITEMS),
  })
  const gridDays = dayCounts.includes(Number(gridValues.days)) ? Number(gridValues.days) : days
  const gridItems = pickItems(gridValues.items, MAX_GRID_ITEMS)
  const gridRows = grid.rows.slice(-gridDays)
  const gridDone = gridItems.reduce((sum, item) => sum + gridRows.filter(row => row.done[item.index]).length, 0)

  const streakValues = settings.readCard('checklist-streak', { item: grid.best?.id ?? '' })
  const streakItem = grid.perItem.find(item => item.id === streakValues.item) ?? grid.best

  const consistencyValues = settings.readCard('checklist-consistency', {
    items: itemIds.slice(0, MAX_CONSISTENCY_ITEMS),
  })
  const consistencyItems = pickItems(consistencyValues.items, MAX_CONSISTENCY_ITEMS)
  const consistency =
    consistencyItems.reduce((sum, item) => sum + item.doneCount, 0) / (consistencyItems.length * days || 1)

  const dailyValues = settings.readCard('checklist-daily-list', { day: grid.latest.date })
  const dailyRow = grid.rows.find(row => row.date === dailyValues.day) ?? grid.latest
  const dailyItems = items.map((item, index) => ({ item, isDone: dailyRow.done[index] }))
  // Past room for all of them, the ticked ones come first, and the rest are counted
  const dailyShown =
    dailyItems.length > MAX_DAILY_LIST_ITEMS
      ? [...dailyItems.filter(({ isDone }) => isDone), ...dailyItems.filter(({ isDone }) => !isDone)].slice(
          0,
          MAX_DAILY_LIST_ITEMS - 1,
        )
      : dailyItems
  const dailyDone = dailyRow.done.filter(Boolean).length

  return (
    <BuildInPublicSection
      title={formatMessage(buildInPublicMessages.checklistTitle)}
      description={formatMessage(buildInPublicMessages.checklistDescription, { count: days })}
      failure={
        hasFailed || haveTicksFailed
          ? {
              message: formatMessage(buildInPublicMessages.checklistLoadFailed),
              isRetrying: loading || areTicksLoading,
              onRetry: () => {
                refetch()
                refetchTicks()
              },
            }
          : null
      }
    >
      <BuildInPublicCard
        cardKey="checklist-grid"
        label={formatMessage(buildInPublicMessages.gridCard)}
        format="square"
        tone="white"
        settings={settings}
        fields={[
          {
            kind: 'select',
            key: 'days',
            label: formatMessage(buildInPublicMessages.daysField),
            options: dayCounts.map(count => ({
              value: String(count),
              label: formatMessage(buildInPublicMessages.days, { count }),
            })),
          },
          ...(isMultiple ? [itemsField(MAX_GRID_ITEMS)] : []),
        ]}
        values={{ days: String(gridDays), items: gridItems.map(item => item.id) }}
      >
        <p className={CARD_EYEBROW_CLASS_NAME}>
          {formatMessage(buildInPublicMessages.checklistDays, { count: gridDays })}
        </p>
        <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-2 text-[26px]/[1.12]')}>
          {formatMessage(buildInPublicMessages.doneOf, { done: gridDone, total: gridItems.length * gridDays })}
        </p>
        <div className="mt-auto flex flex-col gap-2.5">
          {gridItems.map(item => (
            <div
              key={item.id}
              className="flex min-w-0 flex-col gap-1"
            >
              <span className={cn(CARD_MUTED_CLASS_NAME, 'truncate text-[11px] font-medium')}>{item.name}</span>
              <div
                className="grid"
                style={{ gridTemplateColumns: `repeat(${gridDays}, minmax(0, 16px))`, gap: gridDays > 20 ? 2 : 4 }}
              >
                {gridRows.map(row => (
                  <span
                    key={row.date}
                    role="img"
                    aria-label={formatMessage(
                      row.done[item.index] ? buildInPublicMessages.gridCellDone : buildInPublicMessages.gridCellNotDone,
                      { item: item.name, day: formatCardDay(formatDate, row.date) },
                    )}
                    className={cn(
                      'aspect-square rounded-[2px]',
                      row.done[item.index] ? 'bg-(--card-mark)' : 'bg-(--card-square)',
                      row.isToday && !row.done[item.index] && 'shadow-[inset_0_0_0_1.5px_var(--card-mark)]',
                    )}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </BuildInPublicCard>
      {streakItem ? (
        <BuildInPublicCard
          cardKey="checklist-streak"
          label={formatMessage(buildInPublicMessages.checklistStreakCard)}
          format="landscape"
          tone="accent"
          settings={settings}
          fields={
            isMultiple
              ? [
                  {
                    kind: 'select',
                    key: 'item',
                    label: formatMessage(buildInPublicMessages.checklistItem),
                    options: itemOptions,
                  },
                ]
              : []
          }
          values={{ item: streakItem.id }}
        >
          <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-8">
            <div className="flex min-w-0 flex-col">
              <p className={CARD_EYEBROW_CLASS_NAME}>{formatMessage(buildInPublicMessages.currentStreak)}</p>
              <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-auto text-[140px] leading-[0.85]')}>{streakItem.streak}</p>
              <p className="mt-3 mb-0 line-clamp-2 text-base font-medium">
                {formatMessage(buildInPublicMessages.itemStreak, { count: streakItem.streak, item: streakItem.name })}
              </p>
            </div>
            <div className="flex min-w-0 flex-col">
              <p className={cn(CARD_EYEBROW_CLASS_NAME, 'text-right')}>
                {formatMessage(buildInPublicMessages.tasksPerDay)}
              </p>
              <div className={cn('mt-auto flex h-[150px] items-end', days > 20 ? 'gap-0.5' : 'gap-1.5')}>
                {grid.rows.map(row => (
                  <span
                    key={row.date}
                    role="img"
                    aria-label={formatMessage(buildInPublicMessages.dayBar, {
                      day: formatCardDay(formatDate, row.date),
                      done: row.done.filter(Boolean).length,
                      total: items.length,
                    })}
                    className="flex h-full flex-1 items-end rounded-[2px] bg-[color-mix(in_srgb,currentColor_18%,transparent)]"
                  >
                    <span
                      className="w-full rounded-[2px] bg-current"
                      style={{ height: `${(row.done.filter(Boolean).length / (items.length || 1)) * 100}%` }}
                    />
                  </span>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-medium">
                <span>
                  {formatDate(toCalendarDate(grid.rows[0].date), { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                </span>
                <span>{formatMessage(buildInPublicMessages.today)}</span>
              </div>
            </div>
          </div>
        </BuildInPublicCard>
      ) : null}
      <BuildInPublicCard
        cardKey="checklist-consistency"
        label={formatMessage(buildInPublicMessages.consistencyCard)}
        format="portrait"
        tone="white"
        settings={settings}
        fields={isMultiple ? [itemsField(MAX_CONSISTENCY_ITEMS)] : []}
        values={{ items: consistencyItems.map(item => item.id) }}
      >
        <p className={CARD_EYEBROW_CLASS_NAME}>{formatMessage(buildInPublicMessages.checklistDays, { count: days })}</p>
        <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-4 text-[80px] leading-[0.9] text-(--card-strong)')}>
          {formatNumber(consistency, { style: 'percent' })}
        </p>
        <p className={cn(CARD_MUTED_CLASS_NAME, 'mt-2 mb-0 text-sm')}>
          {formatMessage(buildInPublicMessages.dailyTasksDone)}
        </p>
        <div className="mt-auto flex flex-col gap-3.5">
          {consistencyItems.map(item => (
            <div
              key={item.id}
              className="flex flex-col gap-1.5"
            >
              <div className="flex justify-between gap-3 text-[13px]">
                <span className="truncate font-medium">{item.name}</span>
                <span className={cn(CARD_MUTED_CLASS_NAME, 'tabular-nums')}>
                  {item.doneCount}/{days}
                </span>
              </div>
              <BuildInPublicBar ratio={item.doneCount / days} />
            </div>
          ))}
        </div>
      </BuildInPublicCard>
      <BuildInPublicCard
        cardKey="checklist-daily-list"
        label={formatMessage(buildInPublicMessages.dailyListCard)}
        format="square"
        tone="tint"
        settings={settings}
        fields={[
          {
            kind: 'select',
            key: 'day',
            label: formatMessage(buildInPublicMessages.dayField),
            options: [...grid.rows]
              .reverse()
              .map(row => ({ value: row.date, label: formatDay(row.date, row.isToday) })),
          },
        ]}
        values={{ day: dailyRow.date }}
      >
        <p className={CARD_EYEBROW_CLASS_NAME}>{formatDay(dailyRow.date, dailyRow.isToday)}</p>
        <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
          {dailyShown.map(({ item, isDone }) => (
            <li
              key={item.id}
              className="flex min-w-0 items-center gap-3 text-base font-medium"
            >
              <BuildInPublicCheckbox isChecked={isDone} />
              <span className={cn('truncate', !isDone && CARD_MUTED_CLASS_NAME)}>{item.name}</span>
            </li>
          ))}
          {dailyItems.length > dailyShown.length ? (
            <li className={cn(CARD_MUTED_CLASS_NAME, 'pl-[34px] text-sm font-medium')}>
              {formatMessage(buildInPublicMessages.moreTasks, { count: dailyItems.length - dailyShown.length })}
            </li>
          ) : null}
        </ul>
        <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-auto text-[44px]/[1.12] text-(--card-strong)')}>
          {dailyDone}/{items.length}
          <span className={cn(CARD_MUTED_CLASS_NAME, 'ml-2.5 font-sans text-sm tracking-normal')}>
            {formatMessage(buildInPublicMessages.done)}
          </span>
        </p>
      </BuildInPublicCard>
    </BuildInPublicSection>
  )
}

export default BuildInPublicChecklist
