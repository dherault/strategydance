import { useIntl } from 'react-intl'
import { SidebarTrigger } from 'strategydance-design-system/components/ui/Sidebar'
import useSidebar from 'strategydance-design-system/hooks/useSidebar'

import navigationMessages from '~data/intl/messages/navigation'

/*
  The way back to the sidebar whenever it is out of sight: below `md`, where it is a panel over
  the page, and on a wide screen once it has been collapsed. With the sidebar showing it has
  nothing to do, so it takes no room
*/
function SidebarToggleBar() {
  const { formatMessage } = useIntl()
  const { isMobile, state } = useSidebar()

  if (!isMobile && state === 'expanded') return null

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b border-border bg-background px-2">
      <SidebarTrigger label={formatMessage(navigationMessages.toggleSidebar)} />
    </header>
  )
}

export default SidebarToggleBar
