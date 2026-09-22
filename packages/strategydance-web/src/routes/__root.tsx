import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'

import type { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import type { MessageType } from '~types'

import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

import appCss from '../styles.css?url'

// The catalogues every route needs. A route that needs more of its own mounts a second
// IntlMessagesRegistration in its component, rather than widening this one.
// At module scope so the reference is stable across renders
const ROOT_MESSAGE_TYPES: MessageType[] = ['global']

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Strategy Dance' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
})

// Renders the document that wraps the app. In SPA mode this is what gets
// prerendered to a static shell at build time
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

// Inside the document, so holding the tree back for a catalogue leaves <Scripts /> in place
function RootComponent() {
  return (
    <IntlMessagesRegistration messageTypes={ROOT_MESSAGE_TYPES}>
      <Outlet />
    </IntlMessagesRegistration>
  )
}
