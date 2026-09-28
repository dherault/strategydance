import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useIntl } from 'react-intl'
import { createDefaultChecklistItems } from 'strategydance-database/web'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useChecklist from '~hooks/checklist/useChecklist'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'
import checklistMessages from '~data/intl/messages/checklist'

/*
  Starts the reader's checklist in the current organization with the four default habits, in the
  reader's language, the first time they open their Today page there.

  Once their checklist has been read and they never had a column, deleted ones included, it asks
  the server, which makes the four under a lock and refuses when there is any column already. So a
  second tab asking at the same moment is refused, and reads the four the first one made. Asked at
  most once per mount
*/
function useDefaultChecklistItems() {
  const { formatMessage } = useIntl()
  const queryClient = useQueryClient()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const { data: checklist, initialLoading, hasFailed } = useChecklist(viewerId)
  const hasAskedRef = useRef(false)

  const isUnstarted = Boolean(organizationId && viewerId) && !initialLoading && !hasFailed && checklist.anyItem.length === 0

  useEffect(() => {
    if (!isUnstarted || hasAskedRef.current || !organizationId) return

    hasAskedRef.current = true

    createDefaultChecklistItems(dataConnect, {
      organizationId,
      firstName: formatMessage(checklistMessages.defaultReflexion),
      secondName: formatMessage(checklistMessages.defaultTalkToUsers),
      thirdName: formatMessage(checklistMessages.defaultDistribution),
      fourthName: formatMessage(checklistMessages.defaultBuilding),
    })
      .catch(error => {
        // Most likely another tab started it first, which the read below shows
        console.warn('The checklist was not started here', error)
      })
      .finally(() => {
        queryClient.invalidateQueries({ queryKey: ['GetChecklist', organizationId, viewerId] })
      })
  }, [formatMessage, isUnstarted, organizationId, queryClient, viewerId])
}

export default useDefaultChecklistItems
