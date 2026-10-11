import { type ReactNode, useState } from 'react'
import { useIntl } from 'react-intl'
import { MODULES } from 'strategydance-core'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useOAuthAuthorizationRequest from '~hooks/oauth/useOAuthAuthorizationRequest'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import getModuleMessages from '~utils/module/getModuleMessages'
import approveOAuthAuthorizationRequest from '~utils/oauth/approveOAuthAuthorizationRequest'
import denyOAuthAuthorizationRequest from '~utils/oauth/denyOAuthAuthorizationRequest'
import getOAuthConsentFailure from '~utils/oauth/getOAuthConsentFailure'

import Spinner from '~components/common/Spinner'
import OAuthClientVerification from '~components/oauth/OAuthClientVerification'
import OAuthConsentAccess from '~components/oauth/OAuthConsentAccess'
import OAuthConsentFailureNotice from '~components/oauth/OAuthConsentFailureNotice'
import OAuthConsentNotice from '~components/oauth/OAuthConsentNotice'
import OAuthConsentOrganization from '~components/oauth/OAuthConsentOrganization'

import moduleMessages from '~data/intl/messages/module'

type Props = {
  requestId: string
}

// What became of the request once the member answered it
type Outcome = 'redirecting' | 'denied' | 'expired' | 'refused'

/*
  An external agent's request, for the member to allow or deny: who is asking, and what vouches
  for it, never its logo, which would load an address of its choosing; where the member goes back
  to, with a warning when that is only their own computer; the organization the agent will act in,
  the one they have open unless they choose another; and the access, read and write when the agent
  asked for both unless they reduce it.

  Either answer sends the browser back to the agent, replacing this page, so going back never lands
  on a request already decided. While it leaves, the page says where it is going, and both buttons
  stay off. A request that expired or went meanwhile, or an agent that could not be verified, ends
  the page instead; anything else is worth another try
*/
function OAuthConsent({ requestId }: Props) {
  const { formatMessage } = useIntl()
  const { data: request } = useOAuthAuthorizationRequest(requestId)
  const { data: memberships } = useUserOrganizations()
  const { organization: currentOrganization } = useCurrentOrganization()

  const [chosenOrganizationId, setChosenOrganizationId] = useState<string | null>(null)
  const [isWriteChosen, setIsWriteChosen] = useState(true)
  const [decision, setDecision] = useState<'allow' | 'deny' | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const definition = MODULES.find(({ name }) => name === request?.module)

  if (!request || !definition) return null

  const agentName = request.client.name ?? formatMessage(moduleMessages.unnamedAgent)
  const moduleName = formatMessage(getModuleMessages(definition.name).name)
  const organizations = memberships.map(({ organization }) => organization)
  const organization =
    organizations.find(({ id }) => id === chosenOrganizationId)
    ?? organizations.find(({ id }) => id === currentOrganization?.id)
    ?? organizations[0]
    ?? null
  const isWriteAsked = request.scopes.includes(definition.scopes.write)
  const scopes =
    isWriteAsked && isWriteChosen ? [definition.scopes.read, definition.scopes.write] : [definition.scopes.read]
  const isDeciding = decision !== null

  function leave(redirectUrl: string) {
    setOutcome('redirecting')
    window.location.replace(redirectUrl)
  }

  function fail(error: unknown) {
    const failure = getOAuthConsentFailure(error)

    if (failure === 'expired' || failure === 'refused') {
      setOutcome(failure)

      return
    }

    console.error('Failed to answer the authorization request', error)

    toast.error(formatMessage(moduleMessages.decideError))
    setDecision(null)
  }

  async function allow() {
    if (!organization) return

    setDecision('allow')

    try {
      const redirectUrl = await approveOAuthAuthorizationRequest(requestId, organization.id, scopes)

      if (redirectUrl) leave(redirectUrl)
      else setOutcome('refused')
    } catch (error) {
      fail(error)
    }
  }

  async function deny() {
    setDecision('deny')

    try {
      const redirectUrl = await denyOAuthAuthorizationRequest(requestId)

      if (redirectUrl) leave(redirectUrl)
      else setOutcome('denied')
    } catch (error) {
      fail(error)
    }
  }

  if (outcome === 'expired' || outcome === 'refused') return <OAuthConsentFailureNotice failure={outcome} />

  if (outcome === 'denied') {
    return (
      <OAuthConsentNotice
        title={formatMessage(moduleMessages.deniedTitle)}
        description={formatMessage(moduleMessages.deniedDescription, { agentName })}
      />
    )
  }

  if (outcome === 'redirecting') {
    return (
      <p
        role="status"
        className="m-0 flex items-center gap-3 text-base text-muted-foreground"
      >
        <Spinner
          tone="current"
          aria-hidden="true"
        />
        {formatMessage(moduleMessages.redirecting, { host: request.redirectHost })}
      </p>
    )
  }

  const host = (chunks: ReactNode[]) => <strong className="font-medium text-foreground">{chunks}</strong>

  return (
    <>
      <div className="flex flex-col items-start gap-3">
        <h1 className="m-0 text-4xl leading-[1.05] text-balance wrap-break-word sm:text-5xl">
          {formatMessage(moduleMessages.consentTitle, { agentName, moduleName })}
        </h1>
        <OAuthClientVerification
          domain={request.client.isVerified ? request.client.domain : null}
          className="text-sm text-muted-foreground"
        />
      </div>
      <p className="m-0 max-w-xl text-base leading-[1.6] text-pretty text-muted-foreground">
        {formatMessage(moduleMessages.consentLead)}
      </p>
      {request.isLoopbackRedirect ? (
        <Alert
          variant="warning"
          title={formatMessage(moduleMessages.loopbackTitle)}
          className="max-w-xl"
        >
          {formatMessage(moduleMessages.loopbackWarning, { host: request.redirectHost, strong: host })}
        </Alert>
      ) : (
        <p className="m-0 max-w-xl text-sm text-pretty text-muted-foreground">
          {formatMessage(moduleMessages.redirectHost, { host: request.redirectHost, strong: host })}
        </p>
      )}
      <div className="flex max-w-xl flex-col gap-6">
        <OAuthConsentOrganization
          organization={organization}
          onChange={setChosenOrganizationId}
          disabled={isDeciding}
        />
        <OAuthConsentAccess
          module={definition.name}
          isWriteAsked={isWriteAsked}
          isWriteChosen={isWriteChosen}
          onChange={setIsWriteChosen}
          disabled={isDeciding}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={isDeciding || !organization}
          icon={decision === 'allow' ? <Spinner tone="current" /> : undefined}
          onClick={allow}
        >
          {formatMessage(moduleMessages.allow)}
        </Button>
        <Button
          variant="transparent"
          disabled={isDeciding}
          icon={decision === 'deny' ? <Spinner tone="current" /> : undefined}
          onClick={deny}
        >
          {formatMessage(moduleMessages.deny)}
        </Button>
      </div>
    </>
  )
}

export default OAuthConsent
