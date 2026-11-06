import { Link } from '@tanstack/react-router'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button, buttonVariants } from 'strategydance-design-system/components/ui/Button'
import { fieldLabelClassName } from 'strategydance-design-system/components/ui/Field'

import type { Organization } from '~types'

import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import AgentConnectionOrganizationsField from '~components/agentConnection/AgentConnectionOrganizationsField'
import Spinner from '~components/common/Spinner'
import OrganizationMark from '~components/organization/OrganizationMark'

import globalMessages from '~data/intl/messages/global'
import moduleMessages from '~data/intl/messages/module'

type Props = {
  // Those the agent will act in, among the reader's
  chosenIds: string[]
  onChange: (chosenIds: string[]) => void
  disabled: boolean
}

function OrganizationLabel({ organization }: { organization: Organization }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <OrganizationMark
        name={organization.name}
        logoUrl={organization.logoThumbnailUrl ?? organization.logoUrl}
        color={organization.color}
        size="sm"
      />
      <span className="truncate">{organization.name}</span>
    </span>
  )
}

/*
  Which of the reader's organizations the agent will act in: those they tick among several, the one
  they are in, or why there is none to choose. The consent page sits outside the app, which would
  send somebody in no organization to the prologue, so it says so itself, and offers the prologue
*/
function OAuthConsentOrganizations({ chosenIds, onChange, disabled }: Props) {
  const { formatMessage } = useIntl()
  const { data: memberships, hasFailed, loading, refetch } = useUserOrganizations()

  if (hasFailed) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="danger">{formatMessage(globalMessages.organizationsLoadError)}</Alert>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          icon={loading ? <Spinner tone="current" /> : undefined}
          onClick={refetch}
        >
          {formatMessage(globalMessages.retry)}
        </Button>
      </div>
    )
  }

  const [only] = memberships

  if (!only) {
    return (
      <Alert
        title={formatMessage(moduleMessages.noOrganizationTitle)}
        actions={
          <Link
            to="/prologue"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {formatMessage(moduleMessages.createOrganization)}
          </Link>
        }
      >
        {formatMessage(moduleMessages.noOrganizationDescription)}
      </Alert>
    )
  }

  if (memberships.length === 1) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabelClassName}>{formatMessage(moduleMessages.organizationLabel)}</span>
        <OrganizationLabel organization={only.organization} />
      </div>
    )
  }

  return (
    <AgentConnectionOrganizationsField
      organizations={memberships.map(({ organization }) => organization)}
      chosenIds={chosenIds}
      onChange={onChange}
      disabled={disabled}
    />
  )
}

export default OAuthConsentOrganizations
