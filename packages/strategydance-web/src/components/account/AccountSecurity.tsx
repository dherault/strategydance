import { useIntl } from 'react-intl'
import { AuthenticationProvider } from 'strategydance-database/web'
import { Alert } from 'strategydance-design-system/components/ui/Alert'

import useAuthentication from '~hooks/authentication/useAuthentication'

import getAuthenticationProviders from '~utils/user/getAuthenticationProviders'

import AccountPasswordForm from '~components/account/AccountPasswordForm'

import accountMessages from '~data/intl/messages/account'

/*
  How the reader signs in, which today is their password: the form that changes it, or, for an
  account that signs in with Google alone and so has none, a notice saying so. An account with
  both has a password to change.

  Read off the Firebase account rather than the row, which mirrors it, so an account that just
  gained a password does not wait on the mirror to show the form
*/
function AccountSecurity() {
  const { formatMessage } = useIntl()
  const { data: viewer } = useAuthentication()

  // The bouncer above has already turned away a reader signed out, so this only narrows the type
  if (!viewer) return null

  const hasPassword = getAuthenticationProviders(viewer).includes(AuthenticationProvider.PASSWORD)

  if (!hasPassword || !viewer.email) {
    return (
      <Alert
        variant="info"
        title={formatMessage(accountMessages.googleOnlyTitle)}
        className="max-w-[560px]"
      >
        {formatMessage(accountMessages.googleOnlyDescription)}
      </Alert>
    )
  }

  return (
    <AccountPasswordForm
      viewer={viewer}
      email={viewer.email}
    />
  )
}

export default AccountSecurity
