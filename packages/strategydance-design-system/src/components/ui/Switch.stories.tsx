import type { Meta, StoryObj } from '@storybook/react-vite'

import { Switch } from 'strategydance-design-system/components/ui/Switch'

const meta = {
  title: 'Components/Switch',
  component: Switch,
  args: {
    label: 'Daily check-in',
    hint: 'A short prompt every morning at 9.',
  },
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(['md', 'sm'] as const).map(size => (
        <div
          key={size}
          className="flex items-center gap-4"
        >
          <Switch
            size={size}
            aria-label="Off"
          />
          <Switch
            size={size}
            aria-label="On"
            defaultChecked
          />
          <Switch
            size={size}
            aria-label="Disabled"
            disabled
          />
          <Switch
            size={size}
            aria-label="Disabled and on"
            disabled
            defaultChecked
          />
        </div>
      ))}
    </div>
  ),
}

export const Small: Story = {
  args: {
    size: 'sm',
    defaultChecked: true,
  },
}
