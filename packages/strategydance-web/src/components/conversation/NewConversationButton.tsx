import { useNavigate } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { MAX_CONVERSATIONS } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useConversations from '~hooks/conversation/useConversations'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import createId from '~utils/common/createId'

import conversationMessages from '~data/intl/messages/conversation'

/*
  Opens a new conversation's page, a draft at the id it will have, which its first message stores.
  The id is made on the click rather than in the render, which has to stay pure.

  A reader who keeps as many conversations as they may gets no draft they could never send, but
  the reason. The list it counts is the one the page under `ConversationsWait` has read
*/
function NewConversationButton() {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()
  const { data: conversations } = useConversations()

  function start() {
    if (conversations.length >= MAX_CONVERSATIONS) {
      toast.error(formatMessage(conversationMessages.tooMany, { max: MAX_CONVERSATIONS }))

      return
    }

    navigate({
      to: '/$organizationSlug/conversations/$conversationId',
      params: { organizationSlug, conversationId: createId() },
      search: { isNew: true },
    })
  }

  return (
    <Button
      size="sm"
      icon={<PlusIcon />}
      onClick={start}
    >
      {formatMessage(conversationMessages.new)}
    </Button>
  )
}

export default NewConversationButton
