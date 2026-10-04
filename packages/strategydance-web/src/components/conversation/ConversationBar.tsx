import { LockIcon } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import useNow from '~hooks/common/useNow'

import ConversationBackLink from '~components/conversation/ConversationBackLink'
import ConversationUpdatedAt from '~components/conversation/ConversationUpdatedAt'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // When the conversation last changed, or null for a draft, which is not kept until it is sent
  updatedAt: string | null
}

/*
  The top of a conversation's page: back to the list, and on the right that it is private, with
  what that means in a tooltip a tap opens too, and when it last changed
*/
function ConversationBar({ updatedAt }: Props) {
  const { formatMessage } = useIntl()
  const now = useNow()

  return (
    <div className="flex items-center gap-3">
      <ConversationBackLink />
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-2 text-right text-sm text-muted-foreground">
        <Tooltip
          content={formatMessage(conversationMessages.privateTooltip)}
          isOpenedOnTap
          isKeptOpenOnPress
        >
          <button
            type="button"
            className="inline-flex cursor-help items-center gap-1.5 rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            <LockIcon className="size-3.5" />
            {formatMessage(conversationMessages.private)}
          </button>
        </Tooltip>
        <span aria-hidden="true">·</span>
        <span>
          {updatedAt ? (
            <FormattedMessage
              {...conversationMessages.updated}
              values={{
                time: (
                  <ConversationUpdatedAt
                    updatedAt={updatedAt}
                    now={now}
                    isInSentence
                  />
                ),
              }}
            />
          ) : (
            formatMessage(conversationMessages.notSaved)
          )}
        </span>
      </div>
    </div>
  )
}

export default ConversationBar
