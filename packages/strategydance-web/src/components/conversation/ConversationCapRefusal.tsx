import { type MessageDescriptor, useIntl } from 'react-intl'
import {
  DAILY_CAP_WINDOW_HOURS,
  MAX_DAILY_CONVERSATIONS_PER_ACCOUNT,
  MAX_DAILY_CONVERSATIONS_PER_MEMBER,
  MAX_DAILY_CONVERSATIONS_PER_ORGANIZATION,
  MAX_DAILY_RUNS_PER_ACCOUNT,
  MAX_DAILY_RUNS_PER_MEMBER,
  MAX_DAILY_RUNS_PER_ORGANIZATION,
  MAX_DAILY_SPEND_MICRODOLLARS_PER_ACCOUNT,
  MAX_DAILY_SPEND_MICRODOLLARS_PER_MEMBER,
  MAX_DAILY_SPEND_MICRODOLLARS_PER_ORGANIZATION,
} from 'strategydance-core'

import useNow from '~hooks/common/useNow'

import formatSpendCeiling from '~utils/conversation/formatSpendCeiling'
import type { ConversationCapFailure } from '~utils/conversation/getConversationSendFailure'
import getTimeUntil from '~utils/date/getTimeUntil'

import conversationMessages from '~data/intl/messages/conversation'

// A cap's words and value, a spend ceiling's in microdollars, which the words say in dollars
type CapWording = { message: MessageDescriptor; max: number; isSpend?: boolean }

const CAPS: Record<ConversationCapFailure, CapWording> = {
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
  memberSpendCapped: {
    message: conversationMessages.capMemberSpend,
    max: MAX_DAILY_SPEND_MICRODOLLARS_PER_MEMBER,
    isSpend: true,
  },
  accountSpendCapped: {
    message: conversationMessages.capAccountSpend,
    max: MAX_DAILY_SPEND_MICRODOLLARS_PER_ACCOUNT,
    isSpend: true,
  },
  organizationSpendCapped: {
    message: conversationMessages.capOrganizationSpend,
    max: MAX_DAILY_SPEND_MICRODOLLARS_PER_ORGANIZATION,
    isSpend: true,
  },
}

type Props = {
  failure: ConversationCapFailure
  // When the cap has room again, from its refusal's `Retry-After`, or null when it said nothing
  retryAt: number | null
}

/*
  Which daily cap or spend ceiling a send, a resume or a retry reached, and when it has room again, in the words of
  the `conversation` catalogue: "in 3 hours", moving on as the reader waits, and once that time has
  passed, that the cap has room, so the reader tries again. A refusal that said nothing of when is a
  day at most away, as the caps count the 24 hours before each start
*/
function ConversationCapRefusal({ failure, retryAt }: Props) {
  const intl = useIntl()
  const { formatMessage, formatRelativeTime } = intl
  const now = useNow()
  const cap = CAPS[failure]

  if (retryAt !== null && retryAt <= now) return formatMessage(conversationMessages.capFreed)
  const { value, unit } = getTimeUntil(retryAt ?? now + DAILY_CAP_WINDOW_HOURS * 60 * 60 * 1000, now)

  return formatMessage(cap.message, {
    max: cap.isSpend ? formatSpendCeiling(intl, cap.max) : cap.max,
    time: formatRelativeTime(value, unit),
  })
}

export default ConversationCapRefusal
