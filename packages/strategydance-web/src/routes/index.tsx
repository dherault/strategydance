import { Link, createFileRoute } from '@tanstack/react-router'
import { FormattedMessage } from 'react-intl'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'

import LanguageSelect from '~components/intl/LanguageSelect'

import globalMessages from '~data/intl/messages/global'

export const Route = createFileRoute('/')({
  component: IndexRoute,
})

function IndexRoute() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">
        <FormattedMessage {...globalMessages.welcome} />
      </h1>
      <p className="text-neutral-500">
        <FormattedMessage {...globalMessages.tagline} />
      </p>
      <Link
        to="/authentication"
        className={buttonVariants({ size: 'lg' })}
      >
        <FormattedMessage {...globalMessages.signIn} />
      </Link>
      <LanguageSelect />
    </main>
  )
}
