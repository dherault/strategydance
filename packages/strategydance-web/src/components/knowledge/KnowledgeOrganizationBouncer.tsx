import { useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect, useState } from 'react'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

/*
  Keeps a document's page to the organization it opened in. The sidebar switches organization
  without leaving the page, and the document belongs to the one it was opened in: rather than read
  the same id in the next one and say it does not exist, the reader goes to that organization's
  knowledge. The page unmounts first, so whatever it had left to save reaches its own organization.

  The same holds when the reader is removed from it, or it is deleted: the team's live query, kept
  open here, is what tells the app, which moves the current organization on, and this the reader
  with it.

  An effect on the verdict rather than a `<Navigate>`, as `AuthenticationBouncer` explains
*/
function KnowledgeOrganizationBouncer({ children }: PropsWithChildren) {
  const { organization } = useCurrentOrganization()
  const navigate = useNavigate()

  useOrganizationTeam()

  const organizationId = organization?.id ?? null
  const [openedIn] = useState(organizationId)
  const isElsewhere = organizationId !== openedIn

  useEffect(() => {
    // In place of the document, which Back would only open in the wrong organization
    if (isElsewhere) navigate({ to: '/knowledge', replace: true })
  }, [isElsewhere, navigate])

  if (isElsewhere) return null

  return children
}

export default KnowledgeOrganizationBouncer
