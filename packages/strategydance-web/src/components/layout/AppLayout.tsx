import type { PropsWithChildren } from 'react'
import { SidebarInset, SidebarProvider } from 'strategydance-design-system/components/ui/Sidebar'

import usePersistedState from '~hooks/common/usePersistedState'

import AppSidebar from '~components/layout/AppSidebar'
import SidebarToggleBar from '~components/layout/SidebarToggleBar'

/*
  The authenticated area's frame: the sidebar, and the page beside it. A route-level layout
  rather than a provider in the router's `Wrap`, because it renders the page's structure, and
  whether the sidebar is open outlives a reload
*/
function AppLayout({ children }: PropsWithChildren) {
  const [open, setOpen] = usePersistedState('sidebarOpen', true)

  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
    >
      <AppSidebar />
      <SidebarInset>
        <SidebarToggleBar />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}

export default AppLayout
