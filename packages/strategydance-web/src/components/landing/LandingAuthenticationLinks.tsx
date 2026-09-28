import { Link } from '@tanstack/react-router'
import { FormattedMessage } from 'react-intl'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'

import landingMessages from '~data/intl/messages/landing'

/*
  Both buttons lead to the one email-first form, which tells signing in from signing up itself, and
  forwards somebody already signed in into the app
*/
function LandingAuthenticationLinks() {
  return (
    <>
      <Link
        to="/authentication"
        className={buttonVariants({ variant: 'transparent', size: 'sm' })}
      >
        <FormattedMessage {...landingMessages.logIn} />
      </Link>
      <Link
        to="/authentication"
        className={buttonVariants({ size: 'sm' })}
      >
        <FormattedMessage {...landingMessages.signUp} />
      </Link>
    </>
  )
}

export default LandingAuthenticationLinks
