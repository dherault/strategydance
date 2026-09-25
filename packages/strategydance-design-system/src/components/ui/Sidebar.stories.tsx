import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  BotIcon,
  CalendarIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  CircleHelpIcon,
  CompassIcon,
  ListChecksIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'strategydance-design-system/components/ui/DropdownMenu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarTrigger,
} from 'strategydance-design-system/components/ui/Sidebar'

type ExampleGroup = {
  label?: string
  items: {
    label: string
    icon: ReactNode
    active?: boolean
    badge?: number
  }[]
}

const groups: ExampleGroup[] = [
  {
    items: [
      { label: 'Today', icon: <CalendarIcon />, active: true },
      { label: 'Tasks', icon: <ListChecksIcon />, badge: 4 },
      { label: 'Agents', icon: <BotIcon /> },
    ],
  },
  {
    label: 'Company',
    items: [
      { label: 'Strategy', icon: <CompanyAspectIcon aspect="strategy" /> },
      { label: 'Finances', icon: <CompanyAspectIcon aspect="finances" /> },
      { label: 'Product', icon: <CompanyAspectIcon aspect="product" /> },
      { label: 'Explore more aspects', icon: <CompassIcon /> },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Settings', icon: <SettingsIcon /> },
    ],
  },
]

function OrganizationMark({ name, small = false }: { name: string, small?: boolean }) {
  return (
    <span className={small ? 'grid size-6 shrink-0 place-items-center rounded-xs bg-primary text-xs font-semibold text-primary-foreground' : 'grid size-8 shrink-0 place-items-center rounded-xs bg-primary text-sm font-semibold text-primary-foreground'}>
      {name[0]}
    </span>
  )
}

// How the primitives compose into the design's sidebar. The app's own lives in the frontend
function ExampleSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <OrganizationMark name="Strategy Dance" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm leading-tight font-semibold text-secondary">
                      Strategy Dance
                    </span>
                    <span className="truncate text-xs leading-tight text-muted-foreground">
                      Founder
                    </span>
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
                <DropdownMenuLabel>
                  Organizations
                </DropdownMenuLabel>
                <DropdownMenuItem>
                  <OrganizationMark
                    small
                    name="Strategy Dance"
                  />
                  <span className="flex-1">
                    Strategy Dance
                  </span>
                  <CheckIcon className="text-primary" />
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <OrganizationMark
                    small
                    name="Side project"
                  />
                  <span className="flex-1">
                    Side project
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-muted-foreground">
                  <span className="grid size-6 place-items-center rounded-xs border border-border">
                    <PlusIcon />
                  </span>
                  Add organization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map(group => (
          <SidebarGroup key={group.label ?? 'main'}>
            {group.label
              ? (
                  <SidebarGroupLabel>
                    {group.label}
                  </SidebarGroupLabel>
                )
              : null}
            <SidebarMenu>
              {group.items.map(item => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    isActive={item.active}
                    tooltip={item.label}
                  >
                    {item.icon}
                    <span>
                      {item.label}
                    </span>
                  </SidebarMenuButton>
                  {item.badge
                    ? (
                        <SidebarMenuBadge>
                          {item.badge}
                        </SidebarMenuBadge>
                      )
                    : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar name="Alex Martin" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm leading-tight font-semibold text-secondary">
                      Alex Martin
                    </span>
                    <span className="truncate text-xs leading-tight text-muted-foreground">
                      alex@example.com
                    </span>
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
                <DropdownMenuItem>
                  <UserIcon />
                  Account
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CircleHelpIcon />
                  Support
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <LogOutIcon />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

const meta = {
  title: 'Components/Sidebar',
  component: SidebarProvider,
  parameters: {
    layout: 'fullscreen',
  },
  render: args => (
    <SidebarProvider {...args}>
      <ExampleSidebar />
      <SidebarInset className="gap-4 p-4">
        <SidebarTrigger />
        <Alert
          variant="info"
          title="Coming soon"
          className="max-w-lg"
        >
          Toggle the sidebar with the button above, or with Cmd+B.
        </Alert>
      </SidebarInset>
    </SidebarProvider>
  ),
} satisfies Meta<typeof SidebarProvider>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Collapsed: Story = {
  args: {
    defaultOpen: false,
  },
}

export const Loading: Story = {
  render: args => (
    <SidebarProvider {...args}>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>
              Company
            </SidebarGroupLabel>
            <SidebarMenu>
              {['60%', '75%', '50%', '65%'].map(width => (
                <SidebarMenuItem key={width}>
                  <SidebarMenuSkeleton
                    showIcon
                    width={width}
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset />
    </SidebarProvider>
  ),
}
