import { Link } from '@tanstack/react-router'
import { FormattedMessage } from 'react-intl'
import { Logo } from 'strategydance-design-system/components/brand/Logo'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'

import LandingContainer from '~components/landing/LandingContainer'
import GitHubStarButton from '~components/layout/GitHubStarButton'

import landingMessages from '~data/intl/messages/landing'

/*
  Both buttons lead to the one email-first form, which tells signing in from signing up itself, and
  forwards somebody already signed in into the app
*/
function LandingHeader() {
  return (
    <header>
      <LandingContainer className="flex h-16 items-center justify-between gap-4">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-secondary hover:text-secondary"
        >
          <Logo className="h-[22px] w-auto" />
          {/* The name is the wordmark, so it is set as the brand sets it rather than translated */}
          <span className="font-bold tracking-[-0.02em]">
            Strategy Dance
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          {/* Hidden on a phone, where the header has room for the two buttons only */}
          <div className="mr-2 hidden sm:block">
            <GitHubStarButton />
          </div>
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
        </nav>
      </LandingContainer>
    </header>
  )
}

export default LandingHeader
