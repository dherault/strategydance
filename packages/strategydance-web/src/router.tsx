import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'

import IntlProvider from '~components/intl/_IntlProvider'

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
          {children}
        </IntlProvider>
      </QueryClientProvider>
    ),
  })
}
