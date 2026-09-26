import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from 'strategydance-design-system/components/ui/Button'
import { Input } from 'strategydance-design-system/components/ui/Input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'strategydance-design-system/components/ui/Popover'

const meta = {
  title: 'Components/Popover',
  component: Popover,
  args: {
    defaultOpen: true,
  },
  parameters: {
    docs: {
      story: {
        height: '260px',
      },
    },
  },
  render: args => (
    <Popover {...args}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          Rename
        </Button>
      </PopoverTrigger>
      <PopoverContent className="grid gap-3">
        <Input
          label="Organization name"
          defaultValue="Strategy Dance"
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="transparent"
            size="sm"
          >
            Cancel
          </Button>
          <Button size="sm">
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  ),
} satisfies Meta<typeof Popover>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

// Opens above its trigger, as a field near the bottom of a card wants
export const Top: Story = {
  parameters: {
    layout: 'centered',
  },
  render: args => (
    <div className="pt-48">
      <Popover {...args}>
        <PopoverTrigger asChild>
          <Button variant="outline">
            Details
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          className="text-sm"
        >
          Anything interactive belongs in a popover rather than a tooltip.
        </PopoverContent>
      </Popover>
    </div>
  ),
}
