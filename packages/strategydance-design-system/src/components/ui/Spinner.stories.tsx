import type { Meta, StoryObj } from '@storybook/react-vite'

import { Spinner } from 'strategydance-design-system/components/ui/Spinner'

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
} satisfies Meta<typeof Spinner>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: args => (
    <div className="flex items-center gap-4">
      <Spinner
        {...args}
        size="sm"
      />
      <Spinner
        {...args}
        size="md"
      />
      <Spinner
        {...args}
        size="lg"
      />
      <Spinner
        {...args}
        size="xl"
      />
    </div>
  ),
}

export const Tones: Story = {
  render: args => (
    <div className="flex items-center gap-4 text-secondary">
      <Spinner
        {...args}
        tone="primary"
      />
      <Spinner
        {...args}
        tone="current"
      />
      <Spinner
        {...args}
        tone="muted"
      />
    </div>
  ),
}
