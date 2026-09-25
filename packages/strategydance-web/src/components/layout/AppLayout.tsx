import type { PropsWithChildren } from 'react'
import { SidebarInset, SidebarProvider } from 'strategydance-design-system/components/ui/Sidebar'

import AppSidebar from '~components/layout/AppSidebar'
import SidebarToggleBar from '~components/layout/SidebarToggleBar'

/*
  The authenticated area's frame: the sidebar, and the page beside it. A route-level layout
  rather than a provider in the router's `Wrap`, because it renders the page's structure.

  On a wide screen the sidebar is always there, so it is held open and nothing collapses it, the
  keyboard shortcut included. Below `md` it is a panel over the page, opened from the toggle bar
*/
function AppLayout({ children }: PropsWithChildren) {
  return (
    <SidebarProvider open>
      <AppSidebar />
      <SidebarInset>
        <SidebarToggleBar />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}

export default AppLayout
