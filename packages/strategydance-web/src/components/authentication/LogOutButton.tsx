import { LogOutIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'

import useAuthentication from '~hooks/authentication/useAuthentication'

import globalMessages from '~data/intl/messages/global'

type Props = {
  className?: string
}

/*
  The way out of a screen that has no sidebar, and so no user menu: the onboarding and the
  invitation page. Somebody signed into the wrong account could not leave them otherwise, since the
  sign-in screen sends a signed-in reader away. Signing out is enough: the page's bouncer then
  takes them to sign in
*/
function LogOutButton({ className }: Props) {
  const { formatMessage } = useIntl()
  const { signOut } = useAuthentication()

  return (
    <Button
      variant="transparent"
      size="sm"
      icon={<LogOutIcon />}
      onClick={() => signOut()}
      className={className}
    >
      {formatMessage(globalMessages.logOut)}
    </Button>
  )
}

export default LogOutButton
