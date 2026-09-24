import type { Meta, StoryObj } from '@storybook/react-vite'

import { Radio } from 'strategydance-design-system/components/ui/Radio'

const meta = {
  title: 'Components/Radio',
  component: Radio,
  args: {
    name: 'billing',
    label: 'Monthly',
  },
} satisfies Meta<typeof Radio>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Group: Story = {
  render: () => (
    <div
      role="radiogroup"
      aria-label="Billing"
      className="flex flex-col gap-3"
    >
      <Radio
        name="billing-group"
        value="monthly"
        label="Monthly"
        hint="€19 a month, cancel any time."
        defaultChecked
      />
      <Radio
        name="billing-group"
        value="yearly"
        label="Yearly"
        hint="€190 a year, two months free."
      />
      <Radio
        name="billing-group"
        value="lifetime"
        label="Lifetime"
        hint="Not offered during the beta."
        disabled
      />
    </div>
  ),
}

export const WithError: Story = {
  args: {
    error: 'Pick a billing period.',
  },
}
