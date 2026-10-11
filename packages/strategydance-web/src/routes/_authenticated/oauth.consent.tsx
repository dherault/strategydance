import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import parseOAuthConsentRequestId from '~utils/oauth/parseOAuthConsentRequestId'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'
import OAuthConsent from '~components/oauth/OAuthConsent'
import OAuthConsentLayout from '~components/oauth/OAuthConsentLayout'
import OAuthConsentReleaseBouncer from '~components/oauth/OAuthConsentReleaseBouncer'
import OAuthConsentRequestBouncer from '~components/oauth/OAuthConsentRequestBouncer'
import OAuthConsentRequestWait from '~components/oauth/OAuthConsentRequestWait'

// At module scope so the reference is stable across renders
const CONSENT_MESSAGE_TYPES: MessageType[] = ['module']

type OAuthConsentSearch = {
  request?: string
}

/*
  Where an external agent's authorization sends the member's browser, `/oauth/consent?request=<id>`,
  to allow or deny it. Inside the authenticated area, so a reader who is signed out signs in or up
  first, and the sign-in screen brings them back here, the request's id included.

  Outside the app's pathless `_app`, so it takes the whole screen with no sidebar, as an agent's
  consent page does, and is not sent to the prologue for belonging to no organization: it says so
  itself. With no user menu, it carries its own way to log out. `firebase.json` has no site frame
  any page under `/oauth/`, so another site cannot dress Allow up as something else.

  `request` is overwritten with `undefined` when it names no request, since TanStack lays what this
  returns over the raw query rather than replacing it
*/
export const Route = createFileRoute('/_authenticated/oauth/consent')({
  validateSearch: (search: Record<string, unknown>): OAuthConsentSearch => ({
    request: parseOAuthConsentRequestId(search.request),
  }),
  component: OAuthConsentRoute,
})

function OAuthConsentRoute() {
  const { request: requestId } = Route.useSearch()

  return (
    <IntlMessagesRegistration messageTypes={CONSENT_MESSAGE_TYPES}>
      <OAuthConsentLayout>
        <OAuthConsentReleaseBouncer>
          <OAuthConsentRequestWait requestId={requestId}>
            <OAuthConsentRequestBouncer requestId={requestId}>
              {requestId ? <OAuthConsent requestId={requestId} /> : null}
            </OAuthConsentRequestBouncer>
          </OAuthConsentRequestWait>
        </OAuthConsentReleaseBouncer>
      </OAuthConsentLayout>
    </IntlMessagesRegistration>
  )
}
