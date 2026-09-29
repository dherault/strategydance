import { zodResolver } from '@hookform/resolvers/zod'
import { FirebaseError } from 'firebase/app'
import {
  EmailAuthProvider,
  type User as Viewer,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Separator } from 'strategydance-design-system/components/ui/Separator'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import * as z from 'zod'

import {
  AUTHENTICATION_ERRORS,
  DEFAULT_AUTHENTICATION_ERROR,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '~constants'

import useAuthenticationMessage from '~hooks/authentication/useAuthenticationMessage'

import PasswordInput from '~components/common/PasswordInput'
import Spinner from '~components/common/Spinner'
import { FormField } from '~components/ui/FormField'

import { authentication } from '~data/firebase'
import accountMessages from '~data/intl/messages/account'
import authenticationMessages from '~data/intl/messages/authentication'

/*
  zod carries a key rather than a sentence, so the message is formatted in the reader's language
  at render. A key names a message in the account catalogue, or else in the authentication one,
  whose password rules and Firebase errors this form shares with the sign-in screen
*/
const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'currentPasswordRequired'),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, 'validationPasswordMin')
      .max(MAX_PASSWORD_LENGTH, 'validationPasswordMax'),
    newPasswordConfirmation: z.string(),
  })
  .refine(data => data.newPassword !== data.currentPassword, {
    message: 'newPasswordUnchanged',
    path: ['newPassword'],
  })
  .refine(data => data.newPassword === data.newPasswordConfirmation, {
    message: 'validationPasswordConfirmationMismatch',
    path: ['newPasswordConfirmation'],
  })

type PasswordFormValues = z.infer<typeof passwordFormSchema>

const DEFAULT_VALUES: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  newPasswordConfirmation: '',
}

type Props = {
  // An account that signs in with a password
  viewer: Viewer
  // Its address, which a password account always has
  email: string
}

/*
  Changes the password of an account that has one. Firebase asks for a recent sign-in before it
  changes a password, so the current one signs the reader in again first, which is also what
  checks it. Changing it signs out the account's other sessions, and this one carries on with the
  token the change hands back.

  Forgetting the current password sends the reset link here rather than on the sign-in screen,
  since the address is already known
*/
function AccountPasswordForm({ viewer, email }: Props) {
  const { formatMessage } = useIntl()
  const formatAuthenticationMessage = useAuthenticationMessage()

  // One for the three fields, whose eyes reveal them together: it is the reader's own password being
  // shown, not one field's
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  /*
    The fields are read-only while a change is in flight, since a success resets them and anything
    typed meanwhile would be lost. Read-only rather than disabled, so a field the server refused
    can still take the focus
  */
  const { isDirty, isSubmitting } = form.formState

  function formatError(key: string) {
    const descriptor = accountMessages[key as keyof typeof accountMessages]

    return descriptor ? formatMessage(descriptor) : formatAuthenticationMessage(key)
  }

  async function handleSubmit({ currentPassword, newPassword }: PasswordFormValues) {
    try {
      await reauthenticateWithCredential(viewer, EmailAuthProvider.credential(email, currentPassword))
      await updatePassword(viewer, newPassword)

      form.reset(DEFAULT_VALUES)

      toast.success(formatMessage(accountMessages.passwordUpdated))
    } catch (error) {
      const code = error instanceof FirebaseError ? error.code : null

      // A wrong current password is the field's to say, as a password the server finds too weak is
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        form.setError('currentPassword', { message: AUTHENTICATION_ERRORS[code] }, { shouldFocus: true })

        return
      }

      if (code === 'auth/weak-password') {
        form.setError('newPassword', { message: AUTHENTICATION_ERRORS[code] }, { shouldFocus: true })

        return
      }

      console.error('Failed to change the password', error)

      toast.error(formatAuthenticationMessage((code && AUTHENTICATION_ERRORS[code]) || DEFAULT_AUTHENTICATION_ERROR))
    }
  }

  async function sendPasswordReset() {
    setIsSendingReset(true)

    try {
      await sendPasswordResetEmail(authentication, email)

      toast.success(formatMessage(accountMessages.passwordResetSent, { email }))
    } catch (error) {
      console.error('Failed to send the password reset email', error)

      const code = error instanceof FirebaseError ? error.code : null

      toast.error(formatAuthenticationMessage((code && AUTHENTICATION_ERRORS[code]) || DEFAULT_AUTHENTICATION_ERROR))
    } finally {
      setIsSendingReset(false)
    }
  }

  return (
    <section className="max-w-[560px] rounded-xs border border-border bg-white">
      <div className="flex flex-col gap-1 px-5 pt-6 md:px-8 md:pt-8">
        <h2 className="m-0 text-2xl leading-[1.15]">{formatMessage(accountMessages.changePasswordTitle)}</h2>
        <p className="m-0 text-sm leading-normal text-muted-foreground">
          {formatMessage(accountMessages.changePasswordDescription)}
        </p>
      </div>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-5 px-5 pt-6 pb-8 md:px-8"
      >
        {/* For a password manager, which files the new password under the address it goes with */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={email}
          readOnly
          hidden
        />
        <FormField
          control={form.control}
          name="currentPassword"
          id="AccountPasswordForm-current-password"
          label={formatMessage(accountMessages.currentPasswordLabel)}
          formatError={formatError}
        >
          {({ field, fieldState, id, describedBy }) => (
            <PasswordInput
              {...field}
              id={id}
              aria-invalid={fieldState.invalid}
              aria-describedby={describedBy}
              visible={isPasswordVisible}
              onVisibleChange={setIsPasswordVisible}
              autoComplete="current-password"
              readOnly={isSubmitting}
            />
          )}
        </FormField>
        <button
          type="button"
          disabled={isSendingReset || isSubmitting}
          onClick={sendPasswordReset}
          className="-mt-3 cursor-pointer self-start border-0 bg-transparent p-0 font-sans text-xs leading-normal font-medium text-primary hover:text-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {formatMessage(authenticationMessages.passwordForgotQuestion)}
        </button>
        <Separator />
        <FormField
          control={form.control}
          name="newPassword"
          id="AccountPasswordForm-new-password"
          label={formatMessage(accountMessages.newPasswordLabel)}
          description={formatMessage(accountMessages.newPasswordHint, { minPasswordLength: MIN_PASSWORD_LENGTH })}
          formatError={formatError}
        >
          {({ field, fieldState, id, describedBy }) => (
            <PasswordInput
              {...field}
              id={id}
              aria-invalid={fieldState.invalid}
              aria-describedby={describedBy}
              visible={isPasswordVisible}
              onVisibleChange={setIsPasswordVisible}
              autoComplete="new-password"
              readOnly={isSubmitting}
            />
          )}
        </FormField>
        <FormField
          control={form.control}
          name="newPasswordConfirmation"
          id="AccountPasswordForm-new-password-confirmation"
          label={formatMessage(accountMessages.confirmNewPasswordLabel)}
          formatError={formatError}
        >
          {({ field, fieldState, id, describedBy }) => (
            <PasswordInput
              {...field}
              id={id}
              aria-invalid={fieldState.invalid}
              aria-describedby={describedBy}
              visible={isPasswordVisible}
              onVisibleChange={setIsPasswordVisible}
              autoComplete="new-password"
              readOnly={isSubmitting}
            />
          )}
        </FormField>
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!isDirty || isSubmitting}
            icon={isSubmitting ? <Spinner tone="current" /> : undefined}
          >
            {formatMessage(accountMessages.updatePassword)}
          </Button>
        </div>
      </form>
    </section>
  )
}

export default AccountPasswordForm
