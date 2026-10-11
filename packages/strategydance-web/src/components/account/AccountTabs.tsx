import { useMatchRoute, useNavigate } from '@tanstack/react-router'
import { BotIcon, LockIcon, UserIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Tabs } from 'strategydance-design-system/components/ui/Tabs'

import useCanUseModules from '~hooks/module/useCanUseModules'

import accountMessages from '~data/intl/messages/account'
import moduleMessages from '~data/intl/messages/module'

// Each tab is a route of its own, so a tab can be linked to and survives a reload
const PROFILE_PATH = '/account'
const SECURITY_PATH = '/account/security'
const CONNECTED_AGENTS_PATH = '/account/connected-agents'

type AccountTabPath = typeof PROFILE_PATH | typeof SECURITY_PATH | typeof CONNECTED_AGENTS_PATH

/*
  The row of tabs over the account page, in the design system's routing mode: the items carry no
  panels, the selected one follows the route, and choosing one navigates. The panel is the route's
  outlet, below. Connected agents shows only to a reader who may connect agents, as its route's
  bouncer lets in
*/
function AccountTabs() {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const canUseModules = useCanUseModules()

  const paths: AccountTabPath[] = canUseModules
    ? [PROFILE_PATH, SECURITY_PATH, CONNECTED_AGENTS_PATH]
    : [PROFILE_PATH, SECURITY_PATH]
  const value = paths.find(path => path !== PROFILE_PATH && matchRoute({ to: path })) ?? PROFILE_PATH

  return (
    <Tabs
      aria-label={formatMessage(accountMessages.tabsLabel)}
      value={value}
      onValueChange={nextValue => navigate({ to: paths.find(path => path === nextValue) ?? PROFILE_PATH })}
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
        ...(canUseModules
          ? [
              {
                value: CONNECTED_AGENTS_PATH,
                label: formatMessage(moduleMessages.connectedAgentsTab),
                icon: <BotIcon />,
              },
            ]
          : []),
      ]}
    />
  )
}

export default AccountTabs
