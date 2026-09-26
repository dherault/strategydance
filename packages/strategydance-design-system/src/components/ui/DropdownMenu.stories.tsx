import type { Meta, StoryObj } from '@storybook/react-vite'
import { CircleHelpIcon, LogOutIcon, SettingsIcon, UserIcon } from 'lucide-react'

import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from 'strategydance-design-system/components/ui/DropdownMenu'

const meta = {
  title: 'Components/DropdownMenu',
  component: DropdownMenu,
  args: {
    defaultOpen: true,
    modal: false,
  },
  parameters: {
    docs: {
      story: {
        height: '280px',
      },
    },
  },
  render: args => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Alex Martin
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>
          Signed in as alex@example.com
        </DropdownMenuLabel>
        <DropdownMenuItem>
          <UserIcon />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem>
          <SettingsIcon />
          Settings
          <DropdownMenuShortcut>
            ⌘,
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <CircleHelpIcon />
          Support
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked>
          Weekly summary
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
} satisfies Meta<typeof DropdownMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
