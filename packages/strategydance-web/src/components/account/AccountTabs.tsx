import { useMatchRoute, useNavigate } from '@tanstack/react-router'
import { LockIcon, UserIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Tabs } from 'strategydance-design-system/components/ui/Tabs'

import accountMessages from '~data/intl/messages/account'

// Each tab is a route of its own, so a tab can be linked to and survives a reload
const PROFILE_PATH = '/-/account'
const SECURITY_PATH = '/-/account/security'

/*
  The row of tabs over the account page, in the design system's routing mode: the items carry no
  panels, the selected one follows the route, and choosing one navigates. The panel is the route's
  outlet, below
*/
function AccountTabs() {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()

  const value = matchRoute({ to: SECURITY_PATH }) ? SECURITY_PATH : PROFILE_PATH

  return (
    <Tabs
      aria-label={formatMessage(accountMessages.tabsLabel)}
      value={value}
      onValueChange={nextValue => navigate({ to: nextValue === SECURITY_PATH ? SECURITY_PATH : PROFILE_PATH })}
      items={[
        {
          value: PROFILE_PATH,
          label: formatMessage(accountMessages.profileTab),
          icon: <UserIcon />,
        },
        {
          value: SECURITY_PATH,
          label: formatMessage(accountMessages.securityTab),
          icon: <LockIcon />,
        },
      ]}
    />
  )
}

export default AccountTabs
