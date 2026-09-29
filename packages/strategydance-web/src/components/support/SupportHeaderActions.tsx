import { Link } from '@tanstack/react-router'
import { useIntl } from 'react-intl'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'

import useAuthentication from '~hooks/authentication/useAuthentication'

import LandingAuthenticationLinks from '~components/landing/LandingAuthenticationLinks'

import supportMessages from '~data/intl/messages/support'

/*
  Somebody signed in came from the app, and gets a way back to it. Anybody else gets the landing's
  way in. Nothing shows until the session is restored: a reader who is signed in reads as signed
  out until then, and the buttons would change under the pointer
*/
function SupportHeaderActions() {
  const { formatMessage } = useIntl()
  const { data: viewer, loading } = useAuthentication()

  if (loading) return null

  if (!viewer) return <LandingAuthenticationLinks />

  return (
    <Link
      to="/today"
      className={buttonVariants({ variant: 'transparent', size: 'sm' })}
    >
      {formatMessage(supportMessages.backToApp)}
    </Link>
  )
}

export default SupportHeaderActions
