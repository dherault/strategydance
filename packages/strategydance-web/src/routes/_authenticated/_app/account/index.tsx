import { createFileRoute } from '@tanstack/react-router'

import useUser from '~hooks/user/useUser'

import AccountProfile from '~components/account/AccountProfile'

export const Route = createFileRoute('/_authenticated/_app/account/')({
  component: AccountProfileRoute,
})

// `UserWait` above has already waited for the row, so the check below only narrows the type
function AccountProfileRoute() {
  const { data: user } = useUser()

  return user
    ? <AccountProfile user={user} />
    : null
}
