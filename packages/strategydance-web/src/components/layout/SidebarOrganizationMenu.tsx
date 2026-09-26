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
import { cn } from 'strategydance-design-system/lib/utils'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import AddOrganizationDialog from '~components/layout/AddOrganizationDialog'
import OrganizationMark from '~components/organization/OrganizationMark'

import navigationMessages from '~data/intl/messages/navigation'

// The current organization, and the menu that switches it or adds another
function SidebarOrganizationMenu() {
  const { formatMessage } = useIntl()
  const { data: userOrganizations } = useUserOrganizations()
  const { organization, setOrganizationId } = useCurrentOrganization()

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
                <span className={cn('min-w-0 flex-1 truncate text-sm', organization ? 'font-semibold text-secondary' : 'text-muted-foreground')}>
                  {organization?.name ?? formatMessage(navigationMessages.noOrganization)}
                </span>
                <ChevronsUpDownIcon />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              sideOffset={14}
              className="w-60"
            >
              {userOrganizations.length
                ? (
                    <>
                      <DropdownMenuLabel>
                        {formatMessage(navigationMessages.organizations)}
                      </DropdownMenuLabel>
                      {userOrganizations.map(({ organization: { id, name, logoUrl, color } }) => (
                        <DropdownMenuItem
                          key={id}
                          onSelect={() => setOrganizationId(id)}
                        >
                          <OrganizationMark
                            name={name}
                            logoUrl={logoUrl}
                            color={color}
                            className="size-6 text-xs"
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {name}
                          </span>
                          {id === organization?.id ? <CheckIcon className="text-primary" /> : null}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  )
                : null}
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
