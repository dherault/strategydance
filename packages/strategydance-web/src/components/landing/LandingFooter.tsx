import { Link } from '@tanstack/react-router'
import { FormattedMessage } from 'react-intl'

import { GITHUB_REPOSITORY } from '~constants'

import LanguageSelect from '~components/intl/LanguageSelect'
import LandingContainer from '~components/landing/LandingContainer'

import landingMessages from '~data/intl/messages/landing'
import navigationMessages from '~data/intl/messages/navigation'

// At module scope, since reading the clock while rendering is impure
const YEAR = new Date().getFullYear()

// Muted rather than the primary colour every link gets by default
const linkClassName = 'text-muted-foreground hover:text-secondary'

function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <LandingContainer className="flex flex-wrap items-center justify-between gap-4 py-5 text-sm text-muted-foreground">
        <span>
          <FormattedMessage
            {...landingMessages.copyright}
            values={{ year: YEAR }}
          />
        </span>
        <div className="flex flex-wrap items-center gap-5">
          <a
            href={`https://github.com/${GITHUB_REPOSITORY}`}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            <FormattedMessage {...landingMessages.github} />
          </a>
          <Link
            to="/legal"
            className={linkClassName}
          >
            <FormattedMessage {...landingMessages.privacy} />
          </Link>
          <Link
            to="/legal"
            className={linkClassName}
          >
            <FormattedMessage {...landingMessages.terms} />
          </Link>
          <Link
            to="/support"
            className={linkClassName}
          >
            <FormattedMessage {...navigationMessages.support} />
          </Link>
          <LanguageSelect />
        </div>
      </LandingContainer>
    </footer>
  )
}

export default LandingFooter
