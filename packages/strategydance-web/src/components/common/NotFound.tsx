import { Link } from '@tanstack/react-router'
import { useIntl } from 'react-intl'
import { Logo } from 'strategydance-design-system/components/brand/Logo'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'

import globalMessages from '~data/intl/messages/global'

/*
  What an address that leads to no page shows, whether nothing matched it or a page threw
  `notFound()`. The root's `notFoundComponent`, so it takes the whole screen, and its strings are
  in `global`, the one catalogue the root registers.

  Home is the landing page, which is where it leads signed in or not: the landing's own buttons
  forward somebody signed in into the app
*/
function NotFound() {
  const { formatMessage } = useIntl()

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Logo className="w-12 text-secondary" />
      {/* A status code rather than a word, so it is not translated */}
      <p className="m-0 font-heading text-[clamp(6rem,24vw,10rem)] leading-none text-primary">
        404
      </p>
      <h1 className="m-0 text-5xl leading-[1.05] text-balance">
        {formatMessage(globalMessages.notFoundTitle)}
      </h1>
      <p className="m-0 max-w-md text-base leading-[1.6] text-pretty text-muted-foreground">
        {formatMessage(globalMessages.notFoundLead)}
      </p>
      <Link
        to="/"
        className={buttonVariants({ size: 'lg' })}
      >
        {formatMessage(globalMessages.goHome)}
      </Link>
    </main>
  )
}

export default NotFound
