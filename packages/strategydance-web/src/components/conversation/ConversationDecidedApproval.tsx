import type { ComponentProps } from 'react'
import { useIntl } from 'react-intl'

import useConversationApprovalAnswer from '~hooks/conversation/useConversationApprovalAnswer'

import ConversationToolCall from '~components/conversation/ConversationToolCall'

import conversationMessages from '~data/intl/messages/conversation'

type Props = ComponentProps<typeof ConversationToolCall> & {
  // The approval's message, whose answer says whether the reader's Allow met a changed server
  messageId: string
}

/*
  An approval once decided, drawn as the call it became, which says under it, as the card would
  have, when the reader's Allow was denied because the server, the tool or their account there
  changed since the call was proposed. The card that heard it is gone by then, the approval being
  answered, so the answer keeps it for the life of the tab (`useConversationApprovalAnswer`)
*/
function ConversationDecidedApproval({ messageId, issue = null, ...props }: Props) {
  const { formatMessage } = useIntl()
  const [{ isChanged }] = useConversationApprovalAnswer(messageId)

  return (
    <ConversationToolCall
      {...props}
      issue={
        isChanged ? (
          <>
            <p className="m-0 border-t border-border bg-warning-bg px-3 py-2 text-xs leading-[1.4] text-foreground">
              {formatMessage(conversationMessages.approvalChanged, { server: props.integration?.name ?? '' })}
            </p>
            {issue}
          </>
        ) : (
          issue
        )
      }
    />
  )
}

export default ConversationDecidedApproval
