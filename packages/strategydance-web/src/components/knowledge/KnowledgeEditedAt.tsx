import { useIntl } from 'react-intl'

import getTimeAgo from '~utils/date/getTimeAgo'

import knowledgeMessages from '~data/intl/messages/knowledge'

type Props = {
  updatedAt: string
  // The time now, from `useNow`, so the label ages while the page stays open
  now: number
  className?: string
}

/*
  When a document last changed, as its card and its page say it: "Edited 5 minutes ago", in the
  browser's words for the time, then its date past a week. The exact time is the tooltip
*/
function KnowledgeEditedAt({ updatedAt, now, className }: Props) {
  const { formatMessage, formatRelativeTime, formatDate } = useIntl()
  const timeAgo = getTimeAgo(updatedAt, now)

  function getLabel() {
    if (timeAgo.unit === 'justNow') return formatMessage(knowledgeMessages.editedJustNow)

    if (timeAgo.unit === 'date') {
      const isThisYear = new Date(updatedAt).getFullYear() === new Date(now).getFullYear()

      return formatMessage(knowledgeMessages.editedOn, {
        date: formatDate(updatedAt, { month: 'short', day: 'numeric', year: isThisYear ? undefined : 'numeric' }),
      })
    }

    return formatMessage(knowledgeMessages.editedAgo, {
      time: formatRelativeTime(-timeAgo.value, timeAgo.unit, { numeric: 'auto' }),
    })
  }

  return (
    <time
      dateTime={updatedAt}
      title={formatDate(updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
      className={className}
    >
      {getLabel()}
    </time>
  )
}

export default KnowledgeEditedAt
