import type { Meta, StoryObj } from '@storybook/react-vite'

import { Separator } from 'strategydance-design-system/components/ui/Separator'

const meta = {
  title: 'Components/Separator',
  component: Separator,
} satisfies Meta<typeof Separator>

export default meta

type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: args => (
    <div className="flex max-w-xs flex-col gap-3 text-sm">
      Strategy
      <Separator {...args} />
      Finances
    </div>
  ),
}

export const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
  render: args => (
    <div className="flex h-5 items-center gap-3 text-sm">
      Today
      <Separator {...args} />
      Tasks
      <Separator {...args} />
      Agents
    </div>
  ),
}
