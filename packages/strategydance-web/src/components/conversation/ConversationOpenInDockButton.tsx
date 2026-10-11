import { useNavigate } from '@tanstack/react-router'
import { PictureInPicture2Icon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'

import useConversationDock from '~hooks/conversation/useConversationDock'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversationId: string
}

// On a conversation's page, opens it in the dock and goes back to the list, beside which the dock
// draws it: the dock hides on a conversation's page
function ConversationOpenInDockButton({ conversationId }: Props) {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()
  const { openWindow } = useConversationDock()

  function openInDock() {
    openWindow(conversationId)
    navigate({ to: '/$organizationSlug/conversations', params: { organizationSlug } })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      icon={<PictureInPicture2Icon />}
      onClick={openInDock}
    >
      {formatMessage(conversationMessages.openInDock)}
    </Button>
  )
}

export default ConversationOpenInDockButton
