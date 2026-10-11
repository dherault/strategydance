import type { PropsWithChildren } from 'react'
import { useIntl } from 'react-intl'

import LogOutButton from '~components/authentication/LogOutButton'

import moduleMessages from '~data/intl/messages/module'

// The consent page's whole screen, with its own way to log out, and the column every state of it
// shares under one eyebrow
function OAuthConsentLayout({ children }: PropsWithChildren) {
  const { formatMessage } = useIntl()

  return (
    <main className="relative flex min-h-svh items-center justify-center px-4 py-16">
      <LogOutButton className="absolute top-4 right-4" />
      <div className="flex w-full max-w-2xl flex-col gap-6 px-2">
        <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {formatMessage(moduleMessages.consentEyebrow)}
        </p>
        {children}
      </div>
    </main>
  )
}

export default OAuthConsentLayout
