import type { Meta, StoryObj } from '@storybook/react-vite'

import { Textarea } from 'strategydance-design-system/components/ui/Textarea'

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  args: {
    placeholder: 'jane@company.com, sam@company.com\nor one per line',
    rows: 5,
    className: 'max-w-md',
  },
} satisfies Meta<typeof Textarea>

export default meta

type Story = StoryObj<typeof meta>

export const Bare: Story = {}

export const WithLabel: Story = {
  args: {
    label: 'Emails',
    hint: 'Separate emails with commas or new lines.',
  },
}

export const WithError: Story = {
  args: {
    label: 'Emails',
    defaultValue: 'jane@company.com, sam@',
    error: 'Invalid email: sam@',
  },
}

export const Disabled: Story = {
  args: {
    label: 'Emails',
    defaultValue: 'jane@company.com',
    disabled: true,
  },
}
