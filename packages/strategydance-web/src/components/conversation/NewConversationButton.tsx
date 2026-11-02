import { useNavigate } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { MAX_CONVERSATIONS } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import useSidebar from 'strategydance-design-system/hooks/useSidebar'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useConversationDock from '~hooks/conversation/useConversationDock'
import useConversations from '~hooks/conversation/useConversations'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import createId from '~utils/common/createId'

import conversationMessages from '~data/intl/messages/conversation'

/*
  Opens a new conversation, a draft at the id it will have, which its first message stores: in a
  window of the dock on a wide screen, as the design has it, and as its page on a phone, which has
  no dock. The id is made on the click rather than in the render, which has to stay pure.

  A reader who keeps as many conversations as they may gets no draft they could never send, but
  the reason. It counts the reader's own in the list the page under `ConversationsWait` has read,
  the organization's, and the drafts the dock holds, not stored yet, since each may be sent, on a
  phone too, which draws no dock but may grow wide again. A list of a large team's 1000 most
  recently active can hold fewer of the reader's than they keep, when the send's refusal says it
*/
function NewConversationButton() {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()
  const { data: conversations } = useConversations()
  const { data: viewer } = useAuthentication()
  const { isMobile } = useSidebar()
  const { windows, openWindow } = useConversationDock()

  function start() {
    const draftCount = windows.filter(
      ({ conversationId, isDraft }) => isDraft && !conversations.some(({ id }) => id === conversationId),
    ).length

    const ownCount = conversations.filter(({ user }) => user.id === viewer?.uid).length

    if (ownCount + draftCount >= MAX_CONVERSATIONS) {
      toast.error(formatMessage(conversationMessages.tooMany, { max: MAX_CONVERSATIONS }))

      return
    }

    const conversationId = createId()

    if (!isMobile) {
      openWindow(conversationId, { isDraft: true })

      return
    }

    navigate({
      to: '/$organizationSlug/conversations/$conversationId',
      params: { organizationSlug, conversationId },
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
