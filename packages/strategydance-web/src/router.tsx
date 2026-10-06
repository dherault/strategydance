import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'

import AuthenticationProvider from '~components/authentication/_AuthenticationProvider'
import AspectChapterProvider from '~components/company/_AspectChapterProvider'
import IntlProvider from '~components/intl/_IntlProvider'
import CurrentOrganizationProvider from '~components/organization/_CurrentOrganizationProvider'
import UserProvider from '~components/user/_UserProvider'
import UserOrganizationsProvider from '~components/userOrganization/_UserOrganizationsProvider'

import { routeTree } from './routeTree.gen'

// Named `getRouter` and living at `src/router.tsx` because that is the entry
// TanStack Start resolves by convention
export function getRouter() {
  const queryClient = new QueryClient()

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
      current organization is the one the path leads with. Still above the document shell, so the
      same holds as in `Wrap`: render children unconditionally
    */
    InnerWrap: ({ children }) => <CurrentOrganizationProvider>{children}</CurrentOrganizationProvider>,
  })
}
