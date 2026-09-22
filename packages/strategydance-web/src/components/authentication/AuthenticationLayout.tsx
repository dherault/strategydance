import { Link } from '@tanstack/react-router'
import type { PropsWithChildren } from 'react'
import { FormattedMessage } from 'react-intl'

import Logo from '~components/common/Logo'

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
        <Logo className="w-20" />
        <h1 className="mt-2 text-4xl font-semibold">
          Strategy Dance
        </h1>
      </Link>
      <div className="mx-auto mt-1 w-full max-w-[384px]">
        {passwordResetSent && (
          <div
            role="status"
            className="mt-4 rounded-md bg-muted px-4 py-3 text-sm"
          >
            <FormattedMessage {...authenticationMessages.layoutPasswordResetSuccess} />
          </div>
        )}
        <div className="mt-8">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthenticationLayout
