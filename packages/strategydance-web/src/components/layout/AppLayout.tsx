import type { PropsWithChildren } from 'react'
import { SidebarInset, SidebarProvider } from 'strategydance-design-system/components/ui/Sidebar'

import useAspectChapter from '~hooks/company/useAspectChapter'

import AspectChapter from '~components/company/AspectChapter'
import AppSidebar from '~components/layout/AppSidebar'
import SidebarToggleBar from '~components/layout/SidebarToggleBar'

/*
  The authenticated area's frame: the sidebar, and the page beside it. A route-level layout
  rather than a provider in the router's `Wrap`, because it renders the page's structure.

  On a wide screen the sidebar is always there, so it is held open and nothing collapses it: the
  keyboard shortcut is left to the browser. Below `md` it is a panel over the page, opened from
  the toggle bar or the shortcut.

  An aspect's chapter plays over all of it, here rather than on the explore page that starts it,
  because the aspect's page replaces that one beneath it. Everything under the chapter is inert
  until it is gone, so neither a click nor a key reaches the page it covers. The toasts are beside
  this layout rather than in it, so the root covers them itself
*/
function AppLayout({ children }: PropsWithChildren) {
  const { chapter } = useAspectChapter()

  return (
    <>
      <SidebarProvider
        open
        inert={chapter !== null}
      >
        <AppSidebar />
        <SidebarInset>
          <SidebarToggleBar />
          {children}
        </SidebarInset>
      </SidebarProvider>
      {chapter ? (
        <AspectChapter
          aspect={chapter.aspect}
          phase={chapter.phase}
        />
      ) : null}
    </>
  )
}

export default AppLayout
