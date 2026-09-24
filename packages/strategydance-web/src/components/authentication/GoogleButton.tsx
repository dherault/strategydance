import { signInWithPopup } from 'firebase/auth'
import { type ComponentProps, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'

import Spinner from '~components/common/Spinner'

import { authentication, googleProvider } from '~data/firebase'

import authenticationMessages from '~data/intl/messages/authentication'

const googleIcon = (
  <svg
    viewBox="0 0 48 48"
    aria-hidden="true"
  >
    <path
      fill="#ffc107"
      d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
    />
    <path
      fill="#ff3d00"
      d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
    />
    <path
      fill="#4caf50"
      d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
    />
    <path
      fill="#1976d2"
      d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 40.2 44 35 44 24c0-1.3-.1-2.6-.4-3.9z"
    />
  </svg>
)

type Props = Omit<ComponentProps<typeof Button>, 'onClick'> & {
  onErrorCode: (errorCode: string) => void
}

function GoogleButton({ onErrorCode, ...props }: Props) {
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    // A popup takes a moment to appear, which is long enough for a second click. Without this
    // the second one opens a second flow and Firebase cancels the first
    if (loading) return

    setLoading(true)

    /*
      Popup for everybody, not just desktop Safari.

      `signInWithRedirect` hands the credential back through `authDomain`, which is
      `strategydance.firebaseapp.com` while the app is served from web.app and from preview
      channels. That is a cross-origin handoff, and Chrome and Firefox now partition storage
      for it too, so the reader returns from Google signed out and nothing says why. Safari was
      only the first browser to do this.

      The alternative is a same-origin auth helper on the app's own domain, which is worth
      doing the day a popup blocker becomes the bigger problem
    */
    try {
      await signInWithPopup(authentication, googleProvider)
    }
    catch (error: any) {
      console.error('Error during Google sign-in', error)

      onErrorCode(error.code)
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <Button
      {...props}
      variant="outline"
      disabled={loading}
      icon={loading ? <Spinner tone="current" /> : googleIcon}
      onClick={signInWithGoogle}
    >
      <FormattedMessage {...authenticationMessages.googleButtonContinue} />
    </Button>
  )
}

export default GoogleButton
