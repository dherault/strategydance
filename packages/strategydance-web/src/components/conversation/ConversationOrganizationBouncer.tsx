import { useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect, useState } from 'react'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

/*
  Keeps a conversation's page to the organization it opened in, as `KnowledgeOrganizationBouncer`
  keeps a document's. The sidebar switches organization without leaving the page, and the
  conversation belongs to the one it was opened in: rather than read the same id in the next one
  and say it does not exist, the reader goes to that organization's conversations.

  The same holds when the reader is removed from it, or it is deleted: the team's live query, kept
  open here, is what tells the app, which moves the current organization on, and this the reader
  with it.

  An effect on the verdict rather than a `<Navigate>`, as `AuthenticationBouncer` explains
*/
function ConversationOrganizationBouncer({ children }: PropsWithChildren) {
  const { organization } = useCurrentOrganization()
  const navigate = useNavigate()

  useOrganizationTeam()

  const organizationId = organization?.id ?? null
  const [openedIn] = useState(organizationId)
  const isElsewhere = organizationId !== openedIn

  useEffect(() => {
    // In place of the conversation, which Back would only open in the wrong organization
    if (isElsewhere) navigate({ to: '/conversations', replace: true })
  }, [isElsewhere, navigate])

  return children
}

export default ConversationOrganizationBouncer
