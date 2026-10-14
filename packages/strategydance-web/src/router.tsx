import { type Query, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'

import { isAwaitingWrites } from '~utils/common/writeOptimistically'

import AuthenticationProvider from '~components/authentication/_AuthenticationProvider'
import AspectChapterProvider from '~components/company/_AspectChapterProvider'
import ConversationDockProvider from '~components/conversation/_ConversationDockProvider'
import IntlProvider from '~components/intl/_IntlProvider'
import CurrentOrganizationProvider from '~components/organization/_CurrentOrganizationProvider'
import UserProvider from '~components/user/_UserProvider'
import UserOrganizationsProvider from '~components/userOrganization/_UserOrganizationsProvider'

import { routeTree } from './routeTree.gen'

/*
  A query with a change still on its way to the server is not read again as a reader mounts, the
  window takes the focus or the network comes back: the read would answer from before the change and
  take it back, as a task opened the moment it is created would lose it. `writeOptimistically` reads
  it again once its writes settle
*/
function shouldReadAgain(query: Query) {
  return !isAwaitingWrites(query.queryKey)
}

// Named `getRouter` and living at `src/router.tsx` because that is the entry
// TanStack Start resolves by convention
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnMount: shouldReadAgain,
        refetchOnWindowFocus: shouldReadAgain,
        refetchOnReconnect: shouldReadAgain,
      },
    },
  })

  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
    /*
      Wrap sits *above* the document shell, so everything mounted here has to render its children
      unconditionally. A component that withholds them replaces the whole document, <Scripts />
      included, and the page then has no client bundle to boot from and stays on whatever the
      server rendered forever.

      That is why the catalogue waiter is in __root.tsx's component instead: providers belong here,
      anything that gates belongs inside the document
    */
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <IntlProvider>
          <AuthenticationProvider>
            <UserProvider>
              <UserOrganizationsProvider>
                <AspectChapterProvider>{children}</AspectChapterProvider>
              </UserOrganizationsProvider>
            </UserProvider>
          </AuthenticationProvider>
        </IntlProvider>
      </QueryClientProvider>
    ),
    /*
      Inside `Wrap` and inside the router's context, for a provider that reads the router: the
      current organization is the one the path leads with, and the dock's windows are the current
      organization's. Still above the document shell, so the same holds as in `Wrap`: render
      children unconditionally
    */
    InnerWrap: ({ children }) => (
      <CurrentOrganizationProvider>
        <ConversationDockProvider>{children}</ConversationDockProvider>
      </CurrentOrganizationProvider>
    ),
  })
}
