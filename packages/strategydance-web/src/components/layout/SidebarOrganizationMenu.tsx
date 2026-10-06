import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'strategydance-design-system/components/ui/DropdownMenu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from 'strategydance-design-system/components/ui/Sidebar'
import useSidebar from 'strategydance-design-system/hooks/useSidebar'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useSwitchOrganization from '~hooks/organization/useSwitchOrganization'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import AddOrganizationDialog from '~components/layout/AddOrganizationDialog'
import OrganizationMark from '~components/organization/OrganizationMark'

import navigationMessages from '~data/intl/messages/navigation'

// The current organization, and the menu that switches it or adds another
function SidebarOrganizationMenu() {
  const { formatMessage } = useIntl()
  const { data: userOrganizations } = useUserOrganizations()
  const { organization } = useCurrentOrganization()
  const switchOrganization = useSwitchOrganization()
  const { isMobile } = useSidebar()

  const [isAdding, setIsAdding] = useState(false)

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          {/* Not modal, so the dialog it opens can take focus while the menu closes */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg">
                <OrganizationMark
                  name={organization?.name}
                  logoUrl={organization?.logoUrl}
                  color={organization?.color}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-secondary">
                  {organization?.name}
                </span>
                <ChevronsUpDownIcon />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            {/* On a narrow screen the sidebar fills most of the width, so the menu drops below its trigger instead */}
            <DropdownMenuContent
              side={isMobile ? 'bottom' : 'right'}
              align="start"
              sideOffset={isMobile ? 8 : 14}
              className="w-60"
            >
              {userOrganizations.length ? (
                <>
                  <DropdownMenuLabel>{formatMessage(navigationMessages.organizations)}</DropdownMenuLabel>
                  {userOrganizations.map(({ organization: { id, slug, name, logoUrl, color } }) => (
                    <DropdownMenuItem
                      key={id}
                      onSelect={() => switchOrganization({ id, slug })}
                    >
                      <OrganizationMark
                        name={name}
                        logoUrl={logoUrl}
                        color={color}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      {id === organization?.id ? <CheckIcon className="text-primary" /> : null}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem
                onSelect={() => setIsAdding(true)}
                className="text-muted-foreground"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-xs border border-border">
                  <PlusIcon />
                </span>
                {formatMessage(navigationMessages.addOrganization)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <AddOrganizationDialog
        open={isAdding}
        onOpenChange={setIsAdding}
      />
    </>
  )
}

export default SidebarOrganizationMenu
