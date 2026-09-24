import { Link } from '@tanstack/react-router'
import type { PropsWithChildren } from 'react'
import { FormattedMessage } from 'react-intl'
import { Logo } from 'strategydance-design-system/components/brand/Logo'
import { Alert } from 'strategydance-design-system/components/ui/Alert'

import authenticationMessages from '~data/intl/messages/authentication'

type Props = PropsWithChildren<{
  passwordResetSent?: boolean
}>

function AuthenticationLayout({ passwordResetSent, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center px-3 py-8 md:py-16">
      <Link
        to="/"
        className="flex flex-col items-center gap-2"
      >
        <Logo className="w-20 text-secondary" />
        {/* The name is the wordmark, so it is set as the brand sets it rather than as a title */}
        <h1 className="mt-2 font-sans text-4xl font-bold tracking-[-0.02em]">
          Strategy Dance
        </h1>
      </Link>
      <div className="mx-auto mt-1 w-full max-w-[384px]">
        {passwordResetSent && (
          <Alert
            variant="success"
            className="mt-4"
          >
            <FormattedMessage {...authenticationMessages.layoutPasswordResetSuccess} />
          </Alert>
        )}
        <div className="mt-8">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthenticationLayout
