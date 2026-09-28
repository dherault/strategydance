import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Logo } from 'strategydance-design-system/components/brand/Logo'

import LandingAuthenticationLinks from '~components/landing/LandingAuthenticationLinks'
import LandingContainer from '~components/landing/LandingContainer'
import GitHubStarButton from '~components/layout/GitHubStarButton'

type Props = {
  // The buttons after the GitHub one. The way in unless the page has its own
  actions?: ReactNode
}

function LandingHeader({ actions = <LandingAuthenticationLinks /> }: Props) {
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
          {actions}
        </nav>
      </LandingContainer>
    </header>
  )
}

export default LandingHeader
