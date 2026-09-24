import { useIntl } from 'react-intl'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from 'strategydance-design-system/components/ui/Sidebar'

import GitHubStarButton from '~components/layout/GitHubStarButton'
import SidebarNavigation from '~components/layout/SidebarNavigation'
import SidebarOrganizationMenu from '~components/layout/SidebarOrganizationMenu'
import SidebarUserMenu from '~components/layout/SidebarUserMenu'

import navigationMessages from '~data/intl/messages/navigation'

// The prototype's sidebar: the organization on top, the pages, then GitHub and the reader
function AppSidebar() {
  const { formatMessage } = useIntl()

  return (
    <Sidebar label={formatMessage(navigationMessages.sidebar)}>
      <SidebarHeader>
        <SidebarOrganizationMenu />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavigation />
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2">
          <GitHubStarButton />
        </div>
        <SidebarUserMenu />
      </SidebarFooter>
      {/* The sidebar's edge toggles it on click, which is how a pointer brings it back */}
      <SidebarRail label={formatMessage(navigationMessages.toggleSidebar)} />
    </Sidebar>
  )
}

export default AppSidebar
