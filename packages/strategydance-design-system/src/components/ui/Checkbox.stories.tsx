import type { Meta, StoryObj } from '@storybook/react-vite'

import { Checkbox } from 'strategydance-design-system/components/ui/Checkbox'

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  args: {
    label: 'Send me the weekly summary',
  },
} satisfies Meta<typeof Checkbox>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const States: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Checkbox aria-label="Unchecked" />
      <Checkbox
        aria-label="Checked"
        defaultChecked
      />
      <Checkbox
        aria-label="Indeterminate"
        indeterminate
      />
      <Checkbox
        aria-label="Disabled"
        disabled
      />
      <Checkbox
        aria-label="Disabled and checked"
        disabled
        defaultChecked
      />
    </div>
  ),
}

export const WithHint: Story = {
  args: {
    hint: 'Every Monday, what moved and what is due.',
    defaultChecked: true,
  },
}

export const WithError: Story = {
  args: {
    label: 'I accept the terms',
    error: 'Accept the terms to continue.',
  },
}

export const Disabled: Story = {
  args: {
    hint: 'Your plan does not include it.',
    disabled: true,
  },
}
