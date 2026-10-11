import { useIntl } from 'react-intl'

import getTimeAgo from '~utils/date/getTimeAgo'

import moduleMessages from '~data/intl/messages/module'

type Props = {
  lastUsedAt: string | null
  // The time now, from `useNow`, so the label ages while the tab stays open
  now: number
}

/*
  When a connected agent last called its module, as `KnowledgeEditedAt` words a time: "Last used 5
  minutes ago", then its date past a week, the exact time as the tooltip. The module's endpoint
  writes it at most once a minute
*/
function AgentConnectionLastUsed({ lastUsedAt, now }: Props) {
  const { formatMessage, formatRelativeTime, formatDate } = useIntl()

  if (!lastUsedAt) return <span>{formatMessage(moduleMessages.neverUsed)}</span>

  const timeAgo = getTimeAgo(lastUsedAt, now)

  function getLabel(usedAt: string) {
    if (timeAgo.unit === 'justNow') return formatMessage(moduleMessages.lastUsedJustNow)

    if (timeAgo.unit === 'date') {
      const isThisYear = new Date(usedAt).getFullYear() === new Date(now).getFullYear()

      return formatMessage(moduleMessages.lastUsedOn, {
        date: formatDate(usedAt, { month: 'short', day: 'numeric', year: isThisYear ? undefined : 'numeric' }),
      })
    }

    return formatMessage(moduleMessages.lastUsedAgo, {
      time: formatRelativeTime(-timeAgo.value, timeAgo.unit, { numeric: 'auto' }),
    })
  }

  return (
    <time
      dateTime={lastUsedAt}
      title={formatDate(lastUsedAt, { dateStyle: 'medium', timeStyle: 'short' })}
    >
      {getLabel(lastUsedAt)}
    </time>
  )
}

export default AgentConnectionLastUsed
