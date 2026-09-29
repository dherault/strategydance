import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'

import type { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

import type { MessageType } from '~types'

import useAspectChapter from '~hooks/company/useAspectChapter'

import NotFound from '~components/common/NotFound'
import Toaster from '~components/common/Toaster'
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
      { name: 'apple-mobile-web-app-title', content: 'Strategy Dance' },
    ],
    // The favicon set is RealFaviconGenerator's, served from public/ at the site root
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'shortcut icon', href: '/favicon.ico' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  /*
    The catch all: an address nothing matches, and any `notFound()` a page throws, land here unless
    a route between them sets a `notFoundComponent` of its own, and none does. The root keeps
    rendering its component and shows this in its outlet, so the page has the `global` catalogue
    and the toaster, and none of the app's layout
  */
  notFoundComponent: NotFound,
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

/*
  Inside the document, so holding the tree back for a catalogue leaves <Scripts /> in place.

  The toaster is mounted once, here, so a toast raised by a page survives the navigation that
  often follows it. It sits inside the catalogue's waiter because its labels come from `global`.

  An aspect's chapter covers the toasts like the rest of the app, though the app layout that draws
  it is below here: they are hidden and inert until it is gone, rather than drawn over the chapter
  with their buttons in reach, since Sonner puts them above everything else
*/
function RootComponent() {
  const { chapter } = useAspectChapter()

  const isCovered = chapter !== null

  return (
    <IntlMessagesRegistration messageTypes={ROOT_MESSAGE_TYPES}>
      <Outlet />
      <div
        inert={isCovered}
        className={cn(isCovered && 'invisible')}
      >
        <Toaster />
      </div>
    </IntlMessagesRegistration>
  )
}
