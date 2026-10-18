import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { RICH_TEXT_CLASSES } from 'strategydance-design-system/lib/richText'

import { SUPPORT_CONTACT } from '~constants'

import type { ConversationAccessNotice } from '~hooks/conversation/useConversationAccessNotice'

import conversationMessages from '~data/intl/messages/conversation'

const MESSAGES = {
  accountSuspended: conversationMessages.suspensionAccount,
  organizationSuspended: conversationMessages.suspensionOrganization,
  suspended: conversationMessages.accessSuspended,
}

type Props = {
  // Whose conversations staff suspended, the account's or the organization's, or the suspension a
  // refusal named before the rows were read again
  suspension: Exclude<ConversationAccessNotice, 'unverified'>
}

/*
  What the composer shows above the field once Strategy Dance's staff suspended conversations, for
  the reader's account or in the organization: nothing they send is taken, though they still read
  and stop, until staff lift it, and writing to Strategy Dance is the way to talk about it
*/
function ConversationSuspensionNotice({ suspension }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Alert
      variant="danger"
      title={formatMessage(conversationMessages.suspensionTitle)}
    >
      <p className="m-0">
        {formatMessage(MESSAGES[suspension], {
          email: (
            <a
              href={`mailto:${SUPPORT_CONTACT.email}`}
              className={RICH_TEXT_CLASSES.link}
            >
              {SUPPORT_CONTACT.email}
            </a>
          ),
        })}
      </p>
    </Alert>
  )
}

export default ConversationSuspensionNotice
