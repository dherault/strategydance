import type { IntlShape } from 'react-intl'
import {
  type ConversationSpendCeiling,
  MAX_DAILY_SPEND_MICRODOLLARS_PER_ACCOUNT,
  MAX_DAILY_SPEND_MICRODOLLARS_PER_MEMBER,
  MAX_DAILY_SPEND_MICRODOLLARS_PER_ORGANIZATION,
} from 'strategydance-core'

import formatSpendCeiling from '~utils/conversation/formatSpendCeiling'
import getTimeUntil from '~utils/date/getTimeUntil'

import conversationMessages from '~data/intl/messages/conversation'

const CEILINGS = {
  MEMBER: {
    max: MAX_DAILY_SPEND_MICRODOLLARS_PER_MEMBER,
    conversation: conversationMessages.noteCeilingMember,
    subagent: conversationMessages.subagentNoteCeilingMember,
  },
  ACCOUNT: {
    max: MAX_DAILY_SPEND_MICRODOLLARS_PER_ACCOUNT,
    conversation: conversationMessages.noteCeilingAccount,
    subagent: conversationMessages.subagentNoteCeilingAccount,
  },
  ORGANIZATION: {
    max: MAX_DAILY_SPEND_MICRODOLLARS_PER_ORGANIZATION,
    conversation: conversationMessages.noteCeilingOrganization,
    subagent: conversationMessages.subagentNoteCeilingOrganization,
  },
} satisfies Record<ConversationSpendCeiling['scope'], unknown>

/*
  What a failed note says of the daily spend ceiling that stopped its run, in the thread and in a
  conversation's preview: whose, its amount, and when it has room again, "in 3 hours", or once that
  has passed, that it has room, so the reader resumes or retries
*/
function getConversationCeilingNoteText(
  intl: IntlShape,
  { scope, freesAt }: ConversationSpendCeiling,
  subject: 'conversation' | 'subagent',
  now: number,
) {
  const freesAtMs = Date.parse(freesAt)

  if (!(freesAtMs > now)) {
    return intl.formatMessage(
      subject === 'subagent' ? conversationMessages.subagentNoteCeilingFreed : conversationMessages.noteCeilingFreed,
    )
  }

  const ceiling = CEILINGS[scope]
  const { value, unit } = getTimeUntil(freesAtMs, now)

  return intl.formatMessage(ceiling[subject], {
    max: formatSpendCeiling(intl, ceiling.max),
    time: intl.formatRelativeTime(value, unit),
  })
}

export default getConversationCeilingNoteText
