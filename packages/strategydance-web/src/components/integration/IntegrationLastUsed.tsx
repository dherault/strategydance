import { useIntl } from 'react-intl'

import getTimeAgo from '~utils/date/getTimeAgo'

import integrationMessages from '~data/intl/messages/integration'

type Props = {
  lastUsedAt: string | null
  // The time now, from `useNow`, so the label ages while the tab stays open
  now: number
}

/*
  When Strategy Dance last called a server (M29): "5 min ago", then its date past a week, or
  "Never". As `AgentConnectionLastUsed` words a time, without its prefix, under the column's heading
*/
function IntegrationLastUsed({ lastUsedAt, now }: Props) {
  const { formatMessage, formatRelativeTime, formatDate } = useIntl()

  if (!lastUsedAt) return formatMessage(integrationMessages.neverUsed)

  const timeAgo = getTimeAgo(lastUsedAt, now)

  if (timeAgo.unit === 'justNow') return formatMessage(integrationMessages.lastUsedJustNow)

  if (timeAgo.unit === 'date') {
    const isThisYear = new Date(lastUsedAt).getFullYear() === new Date(now).getFullYear()

    return formatDate(lastUsedAt, { month: 'short', day: 'numeric', year: isThisYear ? undefined : 'numeric' })
  }

  return formatRelativeTime(-timeAgo.value, timeAgo.unit, { numeric: 'auto' })
}

export default IntegrationLastUsed
