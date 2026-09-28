import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { createLogEntry } from 'strategydance-database/web'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { LogEntry } from '~types'

import createId from '~utils/common/createId'

import LogEditor from '~components/log/LogEditor'

import { dataConnect } from '~data/firebase'
import logMessages from '~data/intl/messages/log'

type Props = {
  organizationId: string
  // The reader's day, which the entry is for
  today: string
  // The reader's entry for today, once they wrote it
  todayEntry: LogEntry | null
}

/*
  Where the reader writes today's entry, or, once they have, when they did: one entry a day, and
  today's is edited in the feed below.

  What was written stays in the editor until the entry has come back from the server in the feed,
  which then takes the editor's place, and stays too when posting fails, to try again
*/
function LogComposer({ organizationId, today, todayEntry }: Props) {
  const { formatMessage, formatTime } = useIntl()
  const queryClient = useQueryClient()

  const [isPending, setIsPending] = useState(false)

  async function post(content: string) {
    setIsPending(true)

    try {
      await createLogEntry(dataConnect, { organizationId, id: createId(), date: today, content })

      toast.success(formatMessage(logMessages.posted))
      await queryClient.invalidateQueries({ queryKey: ['GetOrganizationLog', organizationId] })
    }
    catch (error) {
      console.error('Failed to post the log entry', error)

      toast.error(formatMessage(logMessages.saveError))
    }
    finally {
      setIsPending(false)
    }
  }

  if (todayEntry) {
    return (
      <p className="m-0 mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-secondary">
          {formatMessage(logMessages.loggedToday, { time: formatTime(todayEntry.createdAt, { hour: 'numeric', minute: '2-digit' }) })}
        </span>
        {' '}
        {formatMessage(logMessages.loggedTodayNext)}
      </p>
    )
  }

  return (
    <LogEditor
      placeholder={formatMessage(logMessages.placeholder)}
      submitLabel={formatMessage(logMessages.post)}
      submitHint={logMessages.postHint}
      isPending={isPending}
      onSubmit={post}
    />
  )
}

export default LogComposer
