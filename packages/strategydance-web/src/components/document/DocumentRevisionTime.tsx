import { useIntl } from 'react-intl'

import getTimeAgo from '~utils/date/getTimeAgo'

import documentMessages from '~data/intl/messages/document'

type Props = {
  createdAt: string
  // The time now, from `useNow`, so the label ages while the history stays open
  now: number
}

/*
  When an entry of a document's history was made, as `DocumentEditedAt` says when a document
  changed: "5 minutes ago", in the browser's words for the time, then its date past a week. The
  exact time is the tooltip
*/
function DocumentRevisionTime({ createdAt, now }: Props) {
  const { formatMessage, formatRelativeTime, formatDate } = useIntl()
  const timeAgo = getTimeAgo(createdAt, now)

  function getLabel() {
    if (timeAgo.unit === 'justNow') return formatMessage(documentMessages.revisionJustNow)

    if (timeAgo.unit === 'date') {
      const isThisYear = new Date(createdAt).getFullYear() === new Date(now).getFullYear()

      return formatDate(createdAt, { month: 'short', day: 'numeric', year: isThisYear ? undefined : 'numeric' })
    }

    return formatRelativeTime(-timeAgo.value, timeAgo.unit, { numeric: 'auto' })
  }

  return (
    <time
      dateTime={createdAt}
      title={formatDate(createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
    >
      {getLabel()}
    </time>
  )
}

export default DocumentRevisionTime
