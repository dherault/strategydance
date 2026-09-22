import { Link, createFileRoute } from '@tanstack/react-router'
import { FormattedMessage } from 'react-intl'

import LanguageSelect from '~components/intl/LanguageSelect'
import { Button } from '~components/ui/Button'

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
      <Button
        asChild
        size="lg"
      >
        <Link to="/authentication">
          <FormattedMessage {...globalMessages.signIn} />
        </Link>
      </Button>
      <LanguageSelect />
    </main>
  )
}
