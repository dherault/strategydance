import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { sendPasswordResetEmail } from 'firebase/auth'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage, useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import * as z from 'zod'

import { AUTHENTICATION_ERRORS, DEFAULT_AUTHENTICATION_ERROR } from '~constants'

import useAuthenticationMessage from '~hooks/authentication/useAuthenticationMessage'

import formatEmail from '~utils/user/formatEmail'

import Spinner from '~components/common/Spinner'
import { FormInputField } from '~components/ui/FormField'

import { authentication } from '~data/firebase'

import authenticationMessages from '~data/intl/messages/authentication'

const formSchema = z.object({
  // Normalize first, validate second. `.trim()` is a transform, so chained after `z.email()`
  // it runs on the way out and the check still sees the raw string: an address pasted with a
  // trailing space was rejected, having been trimmed everywhere else in this flow
  email: z.string().trim().toLowerCase().pipe(z.email('validationEmailInvalid')),
})

type FormValues = z.infer<typeof formSchema>

function AuthenticationPasswordReset() {
  const intl = useIntl()
  const navigate = useNavigate()
  const formatAuthenticationMessage = useAuthenticationMessage()

  const [loading, setLoading] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' },
  })

  async function handleSubmit(values: FormValues) {
    if (loading) return

    setErrorCode(null)
    setLoading(true)

    try {
      await sendPasswordResetEmail(authentication, formatEmail(values.email))
    }
    catch (error: any) {
      /*
        An unknown address takes the success path. Firebase only raises this when email
        enumeration protection is off in the project, and surfacing it would turn this form
        into the account checker the sign-in screen is careful not to be. Every other code is
        a real failure and is shown
      */
      if (error.code !== 'auth/user-not-found') {
        setLoading(false)
        setErrorCode(error.code)

        return
      }
    }

    // The banner says the same thing whether or not the address had an account. The page asked
    // for before signing in comes back along with it
    await navigate({ to: '/authentication', search: ({ redirect }) => ({ passwordResetSent: true, redirect }), replace: true })
  }

  return (
    <>
      <p className="text-center text-sm font-medium">
        <FormattedMessage {...authenticationMessages.passwordResetTitle} />
      </p>
      <p className="mt-1.5 mb-4 text-center text-sm font-medium text-muted-foreground">
        <FormattedMessage {...authenticationMessages.passwordResetDescription} />
      </p>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
      >
        <FormInputField
          control={form.control}
          name="email"
          id="AuthenticationPasswordReset-email"
          label={<FormattedMessage {...authenticationMessages.fieldEmail} />}
          formatError={formatAuthenticationMessage}
          placeholder={intl.formatMessage(authenticationMessages.placeholderEmail)}
          autoComplete="email"
          autoFocus
        />
        <Button
          type="submit"
          disabled={loading}
          icon={loading ? <Spinner tone="current" /> : undefined}
          className="w-full"
        >
          <FormattedMessage {...authenticationMessages.passwordResetAction} />
        </Button>
      </form>
      {!!errorCode && (
        <Alert
          variant="danger"
          className="mt-4"
        >
          {formatAuthenticationMessage(AUTHENTICATION_ERRORS[errorCode] ?? DEFAULT_AUTHENTICATION_ERROR)}
        </Alert>
      )}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => navigate({ to: '/authentication', search: ({ redirect }) => ({ redirect }) })}
          className="cursor-pointer text-sm text-muted-foreground hover:underline"
        >
          <FormattedMessage {...authenticationMessages.actionBack} />
        </button>
      </div>
    </>
  )
}

export default AuthenticationPasswordReset
