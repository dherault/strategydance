import type { Meta, StoryObj } from '@storybook/react-vite'

import { Input } from 'strategydance-design-system/components/ui/Input'

const meta = {
  title: 'Components/Input',
  component: Input,
  args: {
    placeholder: 'Acme Inc.',
    className: 'max-w-xs',
  },
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const Bare: Story = {}

export const WithLabel: Story = {
  args: {
    label: 'Company name',
    hint: 'As it appears on invoices.',
  },
}

export const WithError: Story = {
  args: {
    label: 'Company name',
    defaultValue: 'A',
    error: 'Use at least 2 characters.',
  },
}

export const Disabled: Story = {
  args: {
    label: 'Company name',
    defaultValue: 'Acme Inc.',
    disabled: true,
  },
}
