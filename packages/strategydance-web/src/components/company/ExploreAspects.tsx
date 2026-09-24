import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { CompanyAspect } from 'strategydance-database/web'
import { Alert } from 'strategydance-design-system/components/ui/Alert'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import ExploreAspectCard from '~components/company/ExploreAspectCard'

import exploreMessages from '~data/intl/messages/explore'
import navigationMessages from '~data/intl/messages/navigation'

/*
  Every aspect of a company, the ones the organization works on and the ones it could start on.
  Starting one adds it to the organization, which puts it in the sidebar, and opens its page
*/
function ExploreAspects() {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const { organization } = useCurrentOrganization()
  const { exploreCompanyAspect } = useUserOrganizations()

  const [startingAspect, setStartingAspect] = useState<CompanyAspect | null>(null)
  const [hasFailed, setHasFailed] = useState(false)

  const aspects = Object.values(CompanyAspect)
  const exploredAspects = organization?.exploredAspects ?? []

  async function startExploration(aspect: CompanyAspect) {
    if (!organization || startingAspect) return

    setStartingAspect(aspect)
    setHasFailed(false)

    try {
      await exploreCompanyAspect(organization.id, aspect)
      await navigate({ to: '/-/$aspect', params: { aspect } })
    }
    catch (error) {
      console.error('Failed to explore the aspect', error)

      setHasFailed(true)
    }
    finally {
      setStartingAspect(null)
    }
  }

  return (
    <div className="@container flex max-w-[1120px] flex-col gap-10 px-2 pt-5 pb-12">
      <header className="flex max-w-[640px] flex-col gap-3">
        <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {formatMessage(exploreMessages.explored, { explored: exploredAspects.length, total: aspects.length })}
        </p>
        <h1 className="m-0 text-5xl leading-[1.05]">
          {formatMessage(navigationMessages.exploreMore)}
        </h1>
        <p className="m-0 text-base leading-[1.6] text-pretty text-muted-foreground">
          {formatMessage(exploreMessages.lead)}
        </p>
      </header>
      {organization
        ? null
        : (
            <Alert
              variant="info"
              className="max-w-xl"
            >
              {formatMessage(exploreMessages.noOrganization)}
            </Alert>
          )}
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
            isStarting={startingAspect === aspect}
            isDisabled={!organization || startingAspect !== null}
            onStart={() => startExploration(aspect)}
          />
        ))}
      </div>
    </div>
  )
}

export default ExploreAspects
