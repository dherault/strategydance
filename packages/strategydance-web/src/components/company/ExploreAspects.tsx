import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'
import { Alert } from 'strategydance-design-system/components/ui/Alert'

import { COMPANY_ASPECTS } from '~constants'

import useAspectChapter from '~hooks/company/useAspectChapter'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import ExploreAspectCard from '~components/company/ExploreAspectCard'
import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'

import exploreMessages from '~data/intl/messages/explore'
import navigationMessages from '~data/intl/messages/navigation'

/*
  Every aspect of a company, the ones the organization works on and the ones it could start on.
  Starting one plays its chapter and, beneath it, adds it to the organization, which puts it in
  the sidebar, and opens its page
*/
function ExploreAspects() {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const { organization } = useCurrentOrganization()
  const { exploreCompanyAspect } = useUserOrganizations()
  const { chapter, playChapter } = useAspectChapter()

  const [hasFailed, setHasFailed] = useState(false)

  const aspects = COMPANY_ASPECTS
  const exploredAspects = organization?.exploredAspects ?? []

  async function openAspect(organizationId: string, aspect: CompanyAspect) {
    await exploreCompanyAspect(organizationId, aspect)
    await navigate({ to: '/aspects/$aspect', params: { aspect } })
  }

  /*
    The aspect's chapter goes up the moment it is asked for, and the write and the navigation run
    beneath it, so the telling is the same however long they take. The chapter lifts onto the
    aspect's page, or onto this one when either failed, where the error is by then
  */
  async function startExploration(aspect: CompanyAspect) {
    if (!organization || chapter) return

    setHasFailed(false)

    const pageChange = openAspect(organization.id, aspect)

    playChapter(aspect, pageChange)

    try {
      await pageChange
    }
    catch (error) {
      console.error('Failed to explore the aspect', error)

      setHasFailed(true)
    }
  }

  return (
    <ContainerLayout className="@container gap-10">
      <PageHeader
        eyebrow={formatMessage(exploreMessages.explored, { explored: exploredAspects.length, total: aspects.length })}
        title={formatMessage(navigationMessages.exploreMore)}
        lead={formatMessage(exploreMessages.lead)}
      />
      {hasFailed
        ? (
            <Alert
              variant="danger"
              className="max-w-xl"
            >
              {formatMessage(exploreMessages.startError)}
            </Alert>
          )
        : null}
      <div className="grid auto-rows-fr grid-cols-1 gap-4 @min-[481px]:grid-cols-2 @min-[761px]:grid-cols-3">
        {aspects.map(aspect => (
          <ExploreAspectCard
            key={aspect}
            aspect={aspect}
            isExplored={exploredAspects.includes(aspect)}
            isDisabled={!organization}
            onStart={() => startExploration(aspect)}
          />
        ))}
      </div>
    </ContainerLayout>
  )
}

export default ExploreAspects
