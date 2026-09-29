import type { PropsWithChildren, ReactNode } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

import LandingFooter from '~components/landing/LandingFooter'
import LandingHeader from '~components/landing/LandingHeader'

type Props = PropsWithChildren<{
  // The header's buttons, for a page that has its own
  headerActions?: ReactNode
  // Laid over the main area's own classes, for a page that paints it
  className?: string
}>

// The frame of the public pages: the header on top, the footer at the bottom of the screen at least
function LandingLayout({ headerActions, className, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader actions={headerActions} />
      <main className={cn('flex flex-1 items-center', className)}>{children}</main>
      <LandingFooter />
    </div>
  )
}

export default LandingLayout
