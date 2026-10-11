import { LockIcon } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'
import useSidebar from 'strategydance-design-system/hooks/useSidebar'

import useNow from '~hooks/common/useNow'

import ConversationBackLink from '~components/conversation/ConversationBackLink'
import ConversationOpenInDockButton from '~components/conversation/ConversationOpenInDockButton'
import ConversationUpdatedAt from '~components/conversation/ConversationUpdatedAt'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversationId: string
  // When the conversation last changed, or null for a draft, which is not kept until it is sent
  updatedAt: string | null
}

/*
  The top of a conversation's page: back to the list, and on the right that it is private, with
  what that means in a tooltip a tap opens too, when it last changed, and, on a wide screen, which
  has a dock, "Open in dock" once it is kept
*/
function ConversationBar({ conversationId, updatedAt }: Props) {
  const { formatMessage } = useIntl()
  const now = useNow()
  const { isMobile } = useSidebar()

  return (
    <div className="flex items-center gap-3">
      <ConversationBackLink />
      {/* On a phone the two stack, rather than wrap with the dot between them left hanging */}
      <div className="ml-auto flex min-w-0 items-center justify-end gap-2 text-right text-sm text-muted-foreground max-sm:flex-col max-sm:items-end max-sm:gap-0.5">
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
        <span
          aria-hidden="true"
          className="max-sm:hidden"
        >
          ·
        </span>
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
      {updatedAt && !isMobile ? <ConversationOpenInDockButton conversationId={conversationId} /> : null}
    </div>
  )
}

export default ConversationBar
