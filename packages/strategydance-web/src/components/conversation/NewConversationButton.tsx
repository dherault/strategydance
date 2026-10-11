import { useNavigate } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { MAX_CONVERSATIONS } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import useSidebar from 'strategydance-design-system/hooks/useSidebar'

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
  the reason. The list it counts is the one the page under `ConversationsWait` has read, and the
  drafts the dock holds, not stored yet, count too, since each may be sent, on a phone too, which
  draws no dock but may grow wide again
*/
function NewConversationButton() {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()
  const { data: conversations } = useConversations()
  const { isMobile } = useSidebar()
  const { windows, openWindow } = useConversationDock()

  function start() {
    const draftCount = windows.filter(
      ({ conversationId, isDraft }) => isDraft && !conversations.some(({ id }) => id === conversationId),
    ).length

    if (conversations.length + draftCount >= MAX_CONVERSATIONS) {
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
