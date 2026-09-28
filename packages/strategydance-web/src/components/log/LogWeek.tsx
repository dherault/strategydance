import { Fragment } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'

import type { LogEntry, OrganizationMember } from '~types'

import useOrganizationLogWeek from '~hooks/log/useOrganizationLogWeek'

import addDays from '~utils/date/addDays'
import toCalendarDate from '~utils/date/toCalendarDate'

import Spinner from '~components/common/Spinner'
import LogPost from '~components/log/LogPost'
import TodaySectionLoadFailed from '~components/today/TodaySectionLoadFailed'

import logMessages from '~data/intl/messages/log'

type Props = {
  organizationId: string
  from: string
  to: string
  // The newest week, kept live, which says so when nobody wrote in it
  isLive: boolean
  // The reader's day, for "Today" and "Yesterday"
  today: string
  viewerId: string | null
  membersById: Map<string, OrganizationMember>
  // Set on the oldest week shown, which offers the one before it when there is one
  onLoadPrevious: ((olderDate: string) => void) | null
}

/*
  A week of the log, day by day under a line naming the day, newest first. An entry whose author is
  not on the team any more, in the moment before the live team says so, is left out
*/
function LogWeek({ organizationId, from, to, isLive, today, viewerId, membersById, onLoadPrevious }: Props) {
  const { formatMessage, formatDate } = useIntl()
  const { data: week, initialLoading, hasFailed, loading, refetch } = useOrganizationLogWeek({ from, to, isLive })

  const entries = week.logEntries.filter(entry => membersById.has(entry.user.id))
  const olderDate = week.older[0]?.date ?? null
  const days: { date: string, entries: LogEntry[] }[] = []

  for (const entry of entries) {
    const last = days.at(-1)

    if (last?.date === entry.date) last.entries.push(entry)
    else days.push({ date: entry.date, entries: [entry] })
  }

  function formatDay(date: string) {
    if (date === today) return formatMessage(logMessages.today)
    if (date === addDays(today, -1)) return formatMessage(logMessages.yesterday)

    return formatDate(toCalendarDate(date), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
      timeZone: 'UTC',
    })
  }

  if (initialLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner />
      </div>
    )
  }

  if (hasFailed) {
    return (
      <TodaySectionLoadFailed
        message={formatMessage(logMessages.loadError)}
        isRetrying={loading}
        onRetry={refetch}
      />
    )
  }

  return (
    <>
      {isLive && !days.length
        ? (
            <p className="m-0 mt-2 text-sm text-muted-foreground">
              {formatMessage(logMessages.empty)}
            </p>
          )
        : null}
      {days.map(({ date, entries: dayEntries }) => {
        const label = formatDay(date)

        return (
          <Fragment key={date}>
            <div
              role="separator"
              className="mt-2 flex items-center gap-3 text-xs font-medium tracking-wider text-neutral-500 uppercase before:h-px before:flex-1 before:bg-neutral-200 before:content-[''] after:h-px after:flex-1 after:bg-neutral-200 after:content-['']"
            >
              {label}
            </div>
            <ul
              aria-label={label}
              className="m-0 flex list-none flex-col gap-3 p-0"
            >
              {dayEntries.map(entry => (
                <li key={entry.id}>
                  <LogPost
                    organizationId={organizationId}
                    entry={entry}
                    author={membersById.get(entry.user.id)!}
                    isViewer={entry.user.id === viewerId}
                  />
                </li>
              ))}
            </ul>
          </Fragment>
        )
      })}
      {onLoadPrevious && olderDate
        ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onLoadPrevious(olderDate)}
              >
                {formatMessage(logMessages.loadPrevious)}
              </Button>
            </div>
          )
        : null}
    </>
  )
}

export default LogWeek
