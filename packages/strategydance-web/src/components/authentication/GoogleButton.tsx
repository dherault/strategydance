import { signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { type ComponentProps, useState } from 'react'
import { FormattedMessage } from 'react-intl'

import Spinner from '~components/common/Spinner'
import { Button } from '~components/ui/Button'

import { authentication, googleProvider } from '~data/firebase'

import authenticationMessages from '~data/intl/messages/authentication'

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
      Computed here rather than at module scope, which would read `navigator` while the build
      prerenders the document shell in Node.

      Desktop Safari gets the popup: it partitions storage for the redirect flow, which loses
      the pending sign-in on the way back and lands the reader where they started
    */
    const isSafariDesktop = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
      && !/Mobi|Android/i.test(navigator.userAgent)

    try {
      if (isSafariDesktop) {
        await signInWithPopup(authentication, googleProvider)
      }
      else {
        await signInWithRedirect(authentication, googleProvider)
      }
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
      onClick={signInWithGoogle}
    >
      {loading
        ? (
            <Spinner className="mx-1 size-4" />
          )
        : (
            <svg
              viewBox="0 0 48 48"
              aria-hidden="true"
              className="size-5"
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
          )}
      <div className="ml-1">
        <FormattedMessage {...authenticationMessages.googleButtonContinue} />
      </div>
    </Button>
  )
}

export default GoogleButton
