import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { EyeClosedIcon, EyeIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage, useIntl } from 'react-intl'
import { AuthenticationProvider, getAuthenticationProvidersByEmail } from 'strategydance-database/web'
import * as z from 'zod'

import { AUTHENTICATION_ERRORS, DEFAULT_AUTHENTICATION_ERROR, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '~constants'

import useAuthenticationMessage from '~hooks/authentication/useAuthenticationMessage'

import formatEmail from '~utils/user/formatEmail'

import GoogleButton from '~components/authentication/GoogleButton'
import { Button } from '~components/ui/Button'
import { FieldGroup, FieldSet } from '~components/ui/Field'
import { FormField, FormInputField } from '~components/ui/FormField'
import { Input } from '~components/ui/Input'
import { Label } from '~components/ui/Label'
import { TextDivider } from '~components/ui/TextDivider'

import { authentication, dataConnect } from '~data/firebase'

import authenticationMessages from '~data/intl/messages/authentication'

/*
  Email first, then whatever that email turns out to need. The alternative, a sign in and sign
  up toggle, asks the reader a question they should not have to answer: somebody who signed up
  with Google a year ago does not remember that they did
*/
const MODES = {
  START: 'START',
  LOGIN: 'LOGIN',
  SIGNUP: 'SIGNUP',
} as const

type Mode = typeof MODES[keyof typeof MODES]

// zod carries a *key* into the authentication catalogue rather than a sentence, so the message
// is formatted in the reader's language at render rather than in English at schema definition
const emailFormSchema = z.object({
  email: z.email('validationEmailInvalid').trim().toLowerCase(),
})

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, 'validationPasswordMin')
  .max(MAX_PASSWORD_LENGTH, 'validationPasswordMax')

const passwordFormSchema = z.object({
  password: passwordSchema,
})

const passwordsFormSchema = z.object({
  password: passwordSchema,
  passwordConfirmation: passwordSchema,
})
  .refine(data => data.password === data.passwordConfirmation, {
    message: 'validationPasswordConfirmationMismatch',
    path: ['passwordConfirmation'],
  })

type EmailFormValues = z.infer<typeof emailFormSchema>
type PasswordFormValues = z.infer<typeof passwordFormSchema>
type PasswordsFormValues = z.infer<typeof passwordsFormSchema>

function Authentication() {
  const intl = useIntl()
  const formatAuthenticationMessage = useAuthenticationMessage()

  const [mode, setMode] = useState<Mode>(MODES.START)
  const [loading, setLoading] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [providers, setProviders] = useState<AuthenticationProvider[]>([])
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: '' },
  })

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: '' },
  })

  const passwordsForm = useForm<PasswordsFormValues>({
    resolver: zodResolver(passwordsFormSchema),
    defaultValues: { password: '', passwordConfirmation: '' },
  })

  const email = formatEmail(emailForm.getValues('email'))
  const hasGoogle = providers.includes(AuthenticationProvider.GOOGLE)
  const hasPassword = providers.includes(AuthenticationProvider.PASSWORD)

  async function handleEmailSubmit(values: EmailFormValues) {
    if (loading) return

    setErrorCode(null)
    setLoading(true)
    setProviders([])

    try {
      const { data } = await getAuthenticationProvidersByEmail(dataConnect, { email: formatEmail(values.email) })
      const found = data.users[0]

      if (!found) {
        setMode(MODES.SIGNUP)

        return
      }

      setProviders(found.authenticationProviders)
      setMode(MODES.LOGIN)
    }
    catch (error: any) {
      console.error('Failed to look up the account', error)

      setErrorCode(error.code ?? DEFAULT_AUTHENTICATION_ERROR)
    }
    finally {
      setLoading(false)
    }
  }

  async function handleSignupSubmit(values: PasswordsFormValues) {
    if (loading) return

    setErrorCode(null)
    setLoading(true)

    try {
      await createUserWithEmailAndPassword(authentication, email, values.password)
    }
    catch (error: any) {
      setLoading(false)
      setErrorCode(error.code)
    }
  }

  async function handleLoginSubmit(values: PasswordFormValues) {
    if (loading) return

    setErrorCode(null)
    setLoading(true)

    try {
      await signInWithEmailAndPassword(authentication, email, values.password)
    }
    catch (error: any) {
      setLoading(false)
      setErrorCode(error.code)
    }
  }

  function handleBack() {
    setMode(MODES.START)
    setProviders([])
    setErrorCode(null)
  }

  // One toggle for all three password fields, which reveal together: it is the reader's own
  // password being shown, not one field's
  const visibilityToggle = (
    <button
      type="button"
      onClick={() => setIsPasswordVisible(x => !x)}
      aria-label={intl.formatMessage(isPasswordVisible ? authenticationMessages.actionHidePassword : authenticationMessages.actionShowPassword)}
      className="absolute top-0 right-0 cursor-pointer px-4 py-2.5"
    >
      {isPasswordVisible ? <EyeIcon className="size-4" /> : <EyeClosedIcon className="size-4" />}
    </button>
  )

  return (
    <>
      {mode === MODES.LOGIN && hasGoogle && (
        <>
          {!hasPassword && (
            <Label className="mt-8 block text-center">
              <FormattedMessage
                {...authenticationMessages.modeLoginGreeting}
                values={{ email }}
              />
            </Label>
          )}
          <Label className="mt-2 mb-4 block text-center">
            <FormattedMessage {...(hasPassword ? authenticationMessages.modeLoginBothPrompt : authenticationMessages.modeLoginGooglePrompt)} />
          </Label>
        </>
      )}
      {(mode === MODES.START || hasGoogle) && (
        <GoogleButton
          onErrorCode={setErrorCode}
          className="mt-2 w-full"
        />
      )}
      {mode === MODES.START && (
        <>
          <TextDivider className="mt-6 mb-0.5">
            <FormattedMessage {...authenticationMessages.modeStartOr} />
          </TextDivider>
          <form
            onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
            className="space-y-4"
          >
            <FieldSet>
              <FieldGroup>
                <FormInputField
                  control={emailForm.control}
                  name="email"
                  id="Authentication-email"
                  label={<FormattedMessage {...authenticationMessages.fieldEmail} />}
                  formatError={formatAuthenticationMessage}
                  placeholder={intl.formatMessage(authenticationMessages.placeholderEmail)}
                  autoComplete="email"
                />
              </FieldGroup>
            </FieldSet>
            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              <FormattedMessage {...authenticationMessages.actionContinue} />
            </Button>
          </form>
        </>
      )}
      {mode === MODES.SIGNUP && (
        <>
          <Label className="mt-8 block text-center">
            <FormattedMessage {...authenticationMessages.modeSignupTitle} />
          </Label>
          <Label className="mt-1.5 mb-4 block text-center">
            {email}
          </Label>
          <form
            onSubmit={passwordsForm.handleSubmit(handleSignupSubmit)}
            className="space-y-4"
          >
            <FieldSet>
              <FieldGroup>
                <FormField
                  control={passwordsForm.control}
                  name="password"
                  id="Authentication-signup-password"
                  label={<FormattedMessage {...authenticationMessages.fieldPassword} />}
                  formatError={formatAuthenticationMessage}
                >
                  {({ field, fieldState, id }) => (
                    <div className="relative">
                      <Input
                        {...field}
                        id={id}
                        aria-invalid={fieldState.invalid}
                        autoFocus
                        type={isPasswordVisible ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      {visibilityToggle}
                    </div>
                  )}
                </FormField>
                <FormField
                  control={passwordsForm.control}
                  name="passwordConfirmation"
                  id="Authentication-signup-password-confirmation"
                  label={<FormattedMessage {...authenticationMessages.fieldPasswordConfirmation} />}
                  formatError={formatAuthenticationMessage}
                >
                  {({ field, fieldState, id }) => (
                    <div className="relative">
                      <Input
                        {...field}
                        id={id}
                        aria-invalid={fieldState.invalid}
                        type={isPasswordVisible ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      {visibilityToggle}
                    </div>
                  )}
                </FormField>
              </FieldGroup>
            </FieldSet>
            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              <FormattedMessage {...authenticationMessages.actionSignUp} />
            </Button>
          </form>
        </>
      )}
      {mode === MODES.LOGIN && hasPassword && (
        <>
          {!hasGoogle && (
            <>
              <Label className="mt-8 block text-center">
                <FormattedMessage {...authenticationMessages.modeLoginTitle} />
              </Label>
              <Label className="mt-1.5 mb-4 block text-center">
                {email}
              </Label>
            </>
          )}
          <form
            onSubmit={passwordForm.handleSubmit(handleLoginSubmit)}
            className={hasGoogle ? 'mt-6 space-y-4' : 'space-y-4'}
          >
            <FieldSet>
              <FieldGroup>
                <FormField
                  control={passwordForm.control}
                  name="password"
                  id="Authentication-login-password"
                  label={<FormattedMessage {...authenticationMessages.fieldPassword} />}
                  formatError={formatAuthenticationMessage}
                >
                  {({ field, fieldState, id }) => (
                    <div className="relative">
                      <Input
                        {...field}
                        id={id}
                        aria-invalid={fieldState.invalid}
                        autoFocus
                        type={isPasswordVisible ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      {visibilityToggle}
                    </div>
                  )}
                </FormField>
              </FieldGroup>
            </FieldSet>
            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              <FormattedMessage {...authenticationMessages.actionLogIn} />
            </Button>
          </form>
        </>
      )}
      {!!errorCode && (
        <div className="mt-2 text-sm text-destructive">
          {formatAuthenticationMessage(AUTHENTICATION_ERRORS[errorCode] ?? DEFAULT_AUTHENTICATION_ERROR)}
        </div>
      )}
      <div className="mt-4 flex justify-between gap-4">
        {mode !== MODES.START && (
          <button
            type="button"
            onClick={handleBack}
            className="cursor-pointer text-sm text-muted-foreground hover:underline"
          >
            <FormattedMessage {...authenticationMessages.actionBack} />
          </button>
        )}
        {mode === MODES.LOGIN && hasPassword && (
          <Link
            to="/authentication/password-reset"
            className="text-sm text-muted-foreground hover:underline"
          >
            <FormattedMessage {...authenticationMessages.passwordForgotQuestion} />
          </Link>
        )}
      </div>
    </>
  )
}

export default Authentication
