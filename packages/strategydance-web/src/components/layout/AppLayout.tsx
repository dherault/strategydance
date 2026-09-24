import type { PropsWithChildren } from 'react'
import { useIntl } from 'react-intl'
import { SidebarInset, SidebarProvider, SidebarTrigger } from 'strategydance-design-system/components/ui/Sidebar'

import usePersistedState from '~hooks/common/usePersistedState'

import AppSidebar from '~components/layout/AppSidebar'

import navigationMessages from '~data/intl/messages/navigation'

/*
  The authenticated area's frame: the sidebar, and the page beside it. A route-level layout
  rather than a provider in the router's `Wrap`, because it renders the page's structure, and
  whether the sidebar is open outlives a reload
*/
function AppLayout({ children }: PropsWithChildren) {
  const { formatMessage } = useIntl()
  const [open, setOpen] = usePersistedState('sidebarOpen', true)

  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
    >
      <AppSidebar />
      <SidebarInset>
        {/* Below `md` the sidebar is a panel over the page, and this bar is how to open it */}
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b border-border bg-background px-2 md:hidden">
          <SidebarTrigger label={formatMessage(navigationMessages.toggleSidebar)} />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}

export default AppLayout
