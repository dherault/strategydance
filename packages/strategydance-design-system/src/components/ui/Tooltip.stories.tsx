import type { Meta, StoryObj } from '@storybook/react-vite'
import { SearchIcon } from 'lucide-react'

import { Button } from 'strategydance-design-system/components/ui/Button'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  args: {
    content: 'Search your projects',
    children: (
      <Button
        variant="outline"
        icon={<SearchIcon />}
        aria-label="Search"
      />
    ),
  },
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Tooltip>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  args: {
    defaultOpen: true,
  },
}

export const WithShortcut: Story = {
  args: {
    defaultOpen: true,
    shortcut: '⌘K',
  },
}

export const Sides: Story = {
  render: args => (
    <div className="grid grid-cols-2 gap-x-32 gap-y-16 p-12">
      {(['top', 'right', 'bottom', 'left'] as const).map(side => (
        <Tooltip
          key={side}
          {...args}
          side={side}
          content={`On the ${side}`}
          defaultOpen
        >
          <Button variant="outline">
            {side}
          </Button>
        </Tooltip>
      ))}
    </div>
  ),
}

export const WithoutArrow: Story = {
  args: {
    defaultOpen: true,
    arrow: false,
  },
}

export const OnText: Story = {
  args: {
    content: 'Monthly recurring revenue',
    children: 'MRR',
  },
}
