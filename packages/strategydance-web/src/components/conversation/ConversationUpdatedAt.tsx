import { useIntl } from 'react-intl'

import getTimeAgo from '~utils/date/getTimeAgo'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  updatedAt: string
  // The time now, from `useNow`, so the label ages while the page stays open
  now: number
  // Whether the time is read inside a sentence, as "Updated 5 min ago" is, rather than alone
  isInSentence?: boolean
}

/*
  When a conversation last changed, as its row says it: "Just now", "5 min. ago", "Yesterday", in
  the browser's short words for the time, then its date past a week. Inside a sentence, as the
  conversation's page reads it, it starts in lower case. The exact time is the tooltip
*/
function ConversationUpdatedAt({ updatedAt, now, isInSentence = false }: Props) {
  const { formatMessage, formatRelativeTime, formatDate, locale } = useIntl()
  const timeAgo = getTimeAgo(updatedAt, now)

  function getLabel() {
    if (timeAgo.unit === 'justNow') {
      const justNow = formatMessage(conversationMessages.updatedJustNow)

      return isInSentence ? justNow.charAt(0).toLocaleLowerCase(locale) + justNow.slice(1) : justNow
    }

    if (timeAgo.unit === 'date') {
      const isThisYear = new Date(updatedAt).getFullYear() === new Date(now).getFullYear()

      return formatDate(updatedAt, { month: 'short', day: 'numeric', year: isThisYear ? undefined : 'numeric' })
    }

    const time = formatRelativeTime(-timeAgo.value, timeAgo.unit, { numeric: 'auto', style: 'short' })

    if (isInSentence) return time

    // Alone in its column, the time starts as a sentence does: "Yesterday" rather than "yesterday"
    return time.charAt(0).toLocaleUpperCase(locale) + time.slice(1)
  }

  return (
    <time
      dateTime={updatedAt}
      title={formatDate(updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
    >
      {getLabel()}
    </time>
  )
}

export default ConversationUpdatedAt
