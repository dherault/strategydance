import { useIntl } from 'react-intl'
import {
  DAILY_CAP_WINDOW_HOURS,
  MAX_DAILY_CONVERSATIONS_PER_ACCOUNT,
  MAX_DAILY_CONVERSATIONS_PER_MEMBER,
  MAX_DAILY_CONVERSATIONS_PER_ORGANIZATION,
  MAX_DAILY_RUNS_PER_ACCOUNT,
  MAX_DAILY_RUNS_PER_MEMBER,
  MAX_DAILY_RUNS_PER_ORGANIZATION,
} from 'strategydance-core'

import useNow from '~hooks/common/useNow'

import type { ConversationCapFailure } from '~utils/conversation/getConversationSendFailure'
import getTimeUntil from '~utils/date/getTimeUntil'

import conversationMessages from '~data/intl/messages/conversation'

const CAPS = {
  memberConversationsCapped: {
    message: conversationMessages.capMemberConversations,
    max: MAX_DAILY_CONVERSATIONS_PER_MEMBER,
  },
  accountConversationsCapped: {
    message: conversationMessages.capAccountConversations,
    max: MAX_DAILY_CONVERSATIONS_PER_ACCOUNT,
  },
  organizationConversationsCapped: {
    message: conversationMessages.capOrganizationConversations,
    max: MAX_DAILY_CONVERSATIONS_PER_ORGANIZATION,
  },
  memberRunsCapped: { message: conversationMessages.capMemberRuns, max: MAX_DAILY_RUNS_PER_MEMBER },
  accountRunsCapped: { message: conversationMessages.capAccountRuns, max: MAX_DAILY_RUNS_PER_ACCOUNT },
  organizationRunsCapped: { message: conversationMessages.capOrganizationRuns, max: MAX_DAILY_RUNS_PER_ORGANIZATION },
} satisfies Record<ConversationCapFailure, unknown>

type Props = {
  failure: ConversationCapFailure
  // When the cap has room again, from its refusal's `Retry-After`, or null when it said nothing
  retryAt: number | null
}

/*
  Which daily cap a send, a resume or a retry reached, and when it has room again, in the words of
  the `conversation` catalogue: "in 3 hours", moving on as the reader waits. A refusal that said
  nothing of when is a day at most away, as the caps count the 24 hours before each start
*/
function ConversationCapRefusal({ failure, retryAt }: Props) {
  const { formatMessage, formatRelativeTime } = useIntl()
  const now = useNow()
  const { message, max } = CAPS[failure]
  const { value, unit } = getTimeUntil(retryAt ?? now + DAILY_CAP_WINDOW_HOURS * 60 * 60 * 1000, now)

  return formatMessage(message, { max, time: formatRelativeTime(value, unit) })
}

export default ConversationCapRefusal
