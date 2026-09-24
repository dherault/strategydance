import { useIntl } from 'react-intl'
import { SidebarTrigger } from 'strategydance-design-system/components/ui/Sidebar'
import useSidebar from 'strategydance-design-system/hooks/useSidebar'

import navigationMessages from '~data/intl/messages/navigation'

/*
  How to open the sidebar below `md`, where it is a panel over the page. On a wide screen the
  sidebar is always showing, so the bar takes no room
*/
function SidebarToggleBar() {
  const { formatMessage } = useIntl()
  const { isMobile } = useSidebar()

  if (!isMobile) return null

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b border-border bg-background px-2">
      <SidebarTrigger label={formatMessage(navigationMessages.toggleSidebar)} />
    </header>
  )
}

export default SidebarToggleBar
