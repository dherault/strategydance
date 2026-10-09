import {
  Building2Icon,
  CalendarIcon,
  CompassIcon,
  ContactRoundIcon,
  FileTextIcon,
  LighthouseIcon,
  SquareKanbanIcon,
  StoreIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { useIntl } from 'react-intl'
import { OrganizationRole } from 'strategydance-database/web'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'
import { SidebarGroup, SidebarGroupLabel, SidebarMenu } from 'strategydance-design-system/components/ui/Sidebar'

import { COMPANY_ASPECTS } from '~constants'

import useCanUseConversations from '~hooks/conversation/useCanUseConversations'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'
import useUser from '~hooks/user/useUser'

import toAspectSlug from '~utils/company/toAspectSlug'

import ConversationsNavigationLink from '~components/conversation/ConversationsNavigationLink'
import NavigationLink from '~components/layout/NavigationLink'

import aspectMessages from '~data/intl/aspectMessages'
import navigationMessages from '~data/intl/messages/navigation'

function SidebarNavigation() {
  const { formatMessage } = useIntl()
  const { organization, role } = useCurrentOrganization()
  const organizationSlug = useCurrentOrganizationSlug()
  const { data: user } = useUser()
  const canUseConversations = useCanUseConversations()

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
            path={`/${organizationSlug}/today`}
            label={formatMessage(navigationMessages.today)}
            icon={<CalendarIcon />}
            link={{ to: '/$organizationSlug/today', params: { organizationSlug } }}
          />
          <NavigationLink
            path={`/${organizationSlug}/tasks`}
            isNested
            label={formatMessage(navigationMessages.tasks)}
            icon={<SquareKanbanIcon />}
            link={{ to: '/$organizationSlug/tasks', params: { organizationSlug } }}
          />
          <NavigationLink
            path={`/${organizationSlug}/build-in-public`}
            label={formatMessage(navigationMessages.buildInPublic)}
            icon={<LighthouseIcon />}
            link={{ to: '/$organizationSlug/build-in-public', params: { organizationSlug } }}
          />
        </SidebarMenu>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>{formatMessage(navigationMessages.aspects)}</SidebarGroupLabel>
        <SidebarMenu>
          {exploredAspects.map(aspect => (
            <NavigationLink
              key={aspect}
              path={`/${organizationSlug}/aspects/${toAspectSlug(aspect)}`}
              label={formatMessage(aspectMessages[aspect])}
              icon={<CompanyAspectIcon aspect={toAspectSlug(aspect)} />}
              link={{ to: '/$organizationSlug/aspects/$aspect', params: { organizationSlug, aspect } }}
            />
          ))}
          {exploredAspects.length < COMPANY_ASPECTS.length ? (
            <NavigationLink
              path={`/${organizationSlug}/explore`}
              label={formatMessage(navigationMessages.exploreMore)}
              icon={<CompassIcon />}
              link={{ to: '/$organizationSlug/explore', params: { organizationSlug } }}
            />
          ) : null}
        </SidebarMenu>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>{formatMessage(navigationMessages.reflection)}</SidebarGroupLabel>
        <SidebarMenu>
          {canUseConversations ? <ConversationsNavigationLink /> : null}
          <NavigationLink
            path={`/${organizationSlug}/knowledge`}
            isNested
            label={formatMessage(navigationMessages.knowledge)}
            icon={<FileTextIcon />}
            link={{ to: '/$organizationSlug/knowledge', params: { organizationSlug } }}
          />
        </SidebarMenu>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>{formatMessage(navigationMessages.company)}</SidebarGroupLabel>
        <SidebarMenu>
          <NavigationLink
            path={`/${organizationSlug}/team`}
            label={formatMessage(navigationMessages.team)}
            icon={<UsersRoundIcon />}
            link={{ to: '/$organizationSlug/team', params: { organizationSlug } }}
          />
          {isAdministrator ? (
            <NavigationLink
              path={`/${organizationSlug}/profile`}
              label={formatMessage(navigationMessages.profile)}
              icon={<StoreIcon />}
              link={{ to: '/$organizationSlug/profile', params: { organizationSlug } }}
            />
          ) : null}
        </SidebarMenu>
      </SidebarGroup>
      {/* Only for an administrator of Strategy Dance itself, whatever they are in the organization */}
      {user?.isAdministrator ? (
        <SidebarGroup>
          <SidebarGroupLabel>{formatMessage(navigationMessages.administration)}</SidebarGroupLabel>
          <SidebarMenu>
            <NavigationLink
              path="/administration/users"
              label={formatMessage(navigationMessages.administrationUsers)}
              icon={<ContactRoundIcon />}
              link={{ to: '/administration/users' }}
            />
            <NavigationLink
              path="/administration/organizations"
              label={formatMessage(navigationMessages.administrationOrganizations)}
              icon={<Building2Icon />}
              link={{ to: '/administration/organizations' }}
            />
          </SidebarMenu>
        </SidebarGroup>
      ) : null}
    </>
  )
}

export default SidebarNavigation
