import { useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'

import useConversation from '~hooks/conversation/useConversation'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import toHyphenatedUuid from '~utils/common/toHyphenatedUuid'

type Props = PropsWithChildren<{
  conversationId: string
}>

/*
  A subagent's address is no page of its own: its work is followed from its parent's page, so the
  reader is sent there with the subagent's work open over it, in place of the address they came by,
  and nothing of the page draws meanwhile, so no composer or title ever shows for a subagent. Below
  `ConversationBouncer`, so the conversation is read and there
*/
function ConversationSubagentBouncer({ conversationId, children }: Props) {
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()
  const { data: conversation } = useConversation(conversationId)
  const parentId = conversation?.parentId ?? null

  useEffect(() => {
    if (!parentId) return

    navigate({
      to: '/$organizationSlug/conversations/$conversationId',
      params: { organizationSlug, conversationId: parentId },
      search: { subagent: toHyphenatedUuid(conversationId) },
      replace: true,
    })
  }, [parentId, navigate, organizationSlug, conversationId])

  if (parentId) return null

  return children
}

export default ConversationSubagentBouncer
