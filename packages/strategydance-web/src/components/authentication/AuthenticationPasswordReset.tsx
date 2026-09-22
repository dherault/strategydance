import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { sendPasswordResetEmail } from 'firebase/auth'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage, useIntl } from 'react-intl'
import * as z from 'zod'

import { AUTHENTICATION_ERRORS, DEFAULT_AUTHENTICATION_ERROR } from '~constants'

import useAuthenticationMessage from '~hooks/authentication/useAuthenticationMessage'

import formatEmail from '~utils/user/formatEmail'

import { Button } from '~components/ui/Button'
import { FieldGroup, FieldSet } from '~components/ui/Field'
import { FormInputField } from '~components/ui/FormField'
import { Label } from '~components/ui/Label'

import { authentication } from '~data/firebase'

import authenticationMessages from '~data/intl/messages/authentication'

const formSchema = z.object({
  email: z.email('validationEmailInvalid').trim().toLowerCase(),
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

    // The banner says the same thing whether or not the address had an account
    await navigate({ to: '/authentication', search: { passwordResetSent: true }, replace: true })
  }

  return (
    <>
      <Label className="block text-center">
        <FormattedMessage {...authenticationMessages.passwordResetTitle} />
      </Label>
      <Label className="mt-1.5 mb-4 block text-center text-muted-foreground">
        <FormattedMessage {...authenticationMessages.passwordResetDescription} />
      </Label>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
      >
        <FieldSet>
          <FieldGroup>
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
          </FieldGroup>
        </FieldSet>
        <Button
          type="submit"
          loading={loading}
          className="w-full"
        >
          <FormattedMessage {...authenticationMessages.passwordResetAction} />
        </Button>
      </form>
      {!!errorCode && (
        <div
          role="alert"
          className="mt-2 text-sm text-destructive"
        >
          {formatAuthenticationMessage(AUTHENTICATION_ERRORS[errorCode] ?? DEFAULT_AUTHENTICATION_ERROR)}
        </div>
      )}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => navigate({ to: '/authentication' })}
          className="cursor-pointer text-sm text-muted-foreground hover:underline"
        >
          <FormattedMessage {...authenticationMessages.actionBack} />
        </button>
      </div>
    </>
  )
}

export default AuthenticationPasswordReset
