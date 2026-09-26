import { Link, type LinkProps, useRouterState } from '@tanstack/react-router'
import { BotIcon, CalendarIcon, CompassIcon, ListChecksIcon, SettingsIcon, UsersRoundIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import { OrganizationRole } from 'strategydance-database/web'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from 'strategydance-design-system/components/ui/Sidebar'
import useSidebar from 'strategydance-design-system/hooks/useSidebar'

import { COMPANY_ASPECTS } from '~constants'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import toAspectSlug from '~utils/company/toAspectSlug'

import aspectMessages from '~data/intl/aspectMessages'
import navigationMessages from '~data/intl/messages/navigation'

type NavigationLinkProps = {
  // Matched against the current path to mark the row active
  path: string
  label: string
  icon: ReactNode
  link: LinkProps
}

function NavigationLink({ path, label, icon, link }: NavigationLinkProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const pathname = useRouterState({ select: state => state.location.pathname })

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={pathname === path}
      >
        <Link
          {...link}
          // On a narrow screen the sidebar is a panel over the page, which should get out of the way
          onClick={() => {
            if (isMobile) setOpenMobile(false)
          }}
        >
          {icon}
          <span>
            {label}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function SidebarNavigation() {
  const { formatMessage } = useIntl()
  const { organization, role } = useCurrentOrganization()

  /*
    The organization's explored aspects, in `COMPANY_ASPECTS`'s order rather than the order they
    were explored in. None to begin with, and "Explore more aspects" stays until all nine are there
  */
  const explored = organization?.exploredAspects ?? []
  const exploredAspects = COMPANY_ASPECTS.filter(aspect => explored.includes(aspect))

  // Only an administrator can change anything there, so nobody else is shown the way in. The page
  // says as much to somebody who arrives by its address
  const isAdministrator = role === OrganizationRole.ADMINISTRATOR

  return (
    <>
      <SidebarGroup>
        <SidebarMenu>
          <NavigationLink
            path="/-/today"
            label={formatMessage(navigationMessages.today)}
            icon={<CalendarIcon />}
            link={{ to: '/-/today' }}
          />
          <NavigationLink
            path="/-/tasks"
            label={formatMessage(navigationMessages.tasks)}
            icon={<ListChecksIcon />}
            link={{ to: '/-/tasks' }}
          />
          <NavigationLink
            path="/-/agents"
            label={formatMessage(navigationMessages.agents)}
            icon={<BotIcon />}
            link={{ to: '/-/agents' }}
          />
        </SidebarMenu>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>
          {formatMessage(navigationMessages.aspects)}
        </SidebarGroupLabel>
        <SidebarMenu>
          {exploredAspects.map(aspect => (
            <NavigationLink
              key={aspect}
              path={`/-/${toAspectSlug(aspect)}`}
              label={formatMessage(aspectMessages[aspect])}
              icon={<CompanyAspectIcon aspect={toAspectSlug(aspect)} />}
              link={{ to: '/-/$aspect', params: { aspect } }}
            />
          ))}
          {exploredAspects.length < COMPANY_ASPECTS.length
            ? (
                <NavigationLink
                  path="/-/explore"
                  label={formatMessage(navigationMessages.exploreMore)}
                  icon={<CompassIcon />}
                  link={{ to: '/-/explore' }}
                />
              )
            : null}
        </SidebarMenu>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>
          {formatMessage(navigationMessages.company)}
        </SidebarGroupLabel>
        <SidebarMenu>
          <NavigationLink
            path="/-/team"
            label={formatMessage(navigationMessages.team)}
            icon={<UsersRoundIcon />}
            link={{ to: '/-/team' }}
          />
          {isAdministrator
            ? (
                <NavigationLink
                  path="/-/settings"
                  label={formatMessage(navigationMessages.settings)}
                  icon={<SettingsIcon />}
                  link={{ to: '/-/settings' }}
                />
              )
            : null}
        </SidebarMenu>
      </SidebarGroup>
    </>
  )
}

export default SidebarNavigation
