import type { PropsWithChildren } from 'react'

import LandingFooter from '~components/landing/LandingFooter'
import LandingHeader from '~components/landing/LandingHeader'

// The frame of the public pages: the header on top, the footer at the bottom of the screen at least
function LandingLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex flex-1 items-center">
        {children}
      </main>
      <LandingFooter />
    </div>
  )
}

export default LandingLayout
