import type { PropsWithChildren } from 'react'
import { useIntl } from 'react-intl'

import LogOutButton from '~components/authentication/LogOutButton'

import moduleMessages from '~data/intl/messages/module'

// The consent page's whole screen, with its own way to log out, and the column every state of it
// shares under one eyebrow. The column is the width of the text and fields it holds, which take
// all of it, so whatever it shows sits in the middle of the screen
function OAuthConsentLayout({ children }: PropsWithChildren) {
  const { formatMessage } = useIntl()

  return (
    <main className="relative flex min-h-svh items-center justify-center px-6 py-16">
      <LogOutButton className="absolute top-4 right-4" />
      <div className="flex w-full max-w-xl flex-col gap-6">
        <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {formatMessage(moduleMessages.consentEyebrow)}
        </p>
        {children}
      </div>
    </main>
  )
}

export default OAuthConsentLayout
