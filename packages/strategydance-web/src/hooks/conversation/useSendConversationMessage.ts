import type { SendConversationMessageData } from 'strategydance-core'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

type ConversationMessageSend = {
  conversationId: string
  // Made by the browser, and kept for every retry of the same send, which the backend stores once
  messageId: string
  text: string
}

/*
  Sends the reader's message to one of their conversations in the current organization, or to a
  draft, which the first message stores. The backend answers once the message and its run are
  stored, with the run's id: the page's live reads then bring both in. A retry with the same
  message's id answers with the same run, so a send whose answer was lost can be sent again
*/
function useSendConversationMessage() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  return async function sendConversationMessage({ conversationId, messageId, text }: ConversationMessageSend) {
    if (!organizationId) throw new Error('No organization is current')

    return requestApi<SendConversationMessageData>({
      method: 'POST',
      path: `/organizations/${organizationId}/conversations/${conversationId}/messages`,
      body: { messageId, text },
    })
  }
}

export default useSendConversationMessage
