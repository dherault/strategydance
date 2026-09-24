import { ChevronsUpDownIcon, CircleHelpIcon, LogOutIcon, UserIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'strategydance-design-system/components/ui/DropdownMenu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from 'strategydance-design-system/components/ui/Sidebar'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useUser from '~hooks/user/useUser'

import navigationMessages from '~data/intl/messages/navigation'

/*
  The reader, and their menu. Account and Support have no page yet, so they show disabled rather
  than doing nothing when chosen
*/
function SidebarUserMenu() {
  const { formatMessage } = useIntl()
  const { data: user } = useUser()
  const { signOut } = useAuthentication()

  const name = user?.displayName || user?.email || ''

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <Avatar
                src={user?.imageUrl ?? undefined}
                name={name}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm leading-tight font-semibold text-secondary">
                  {name}
                </span>
                {user?.displayName
                  ? (
                      <span className="truncate text-xs leading-tight text-muted-foreground">
                        {user.email}
                      </span>
                    )
                  : null}
              </span>
              <ChevronsUpDownIcon />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="end"
            sideOffset={14}
            className="w-44"
          >
            <DropdownMenuItem disabled>
              <UserIcon />
              {formatMessage(navigationMessages.account)}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <CircleHelpIcon />
              {formatMessage(navigationMessages.support)}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => signOut()}
            >
              <LogOutIcon />
              {formatMessage(navigationMessages.logOut)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export default SidebarUserMenu
