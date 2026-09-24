import type { Meta, StoryObj } from '@storybook/react-vite'

import { Select } from 'strategydance-design-system/components/ui/Select'

const meta = {
  title: 'Components/Select',
  component: Select,
  args: {
    options: ['Solo founder', 'Two founders', 'Three or more'],
    placeholder: 'Team size',
    className: 'max-w-xs',
  },
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLabel: Story = {
  args: {
    label: 'Team',
    hint: 'Who is building it today.',
    defaultValue: 'Solo founder',
  },
}

export const Groups: Story = {
  args: {
    label: 'Stage',
    options: [
      {
        label: 'Before launch',
        options: ['Idea', 'Prototype'],
      },
      {
        label: 'After launch',
        options: [
          { value: 'first-users', label: 'First users' },
          { value: 'revenue', label: 'Revenue' },
          { value: 'profitable', label: 'Profitable', disabled: true },
        ],
      },
    ],
    placeholder: 'Pick a stage',
  },
}

export const Open: Story = {
  args: {
    defaultValue: 'Two founders',
    defaultOpen: true,
  },
  parameters: {
    layout: 'padded',
    docs: {
      story: {
        height: '240px',
      },
    },
  },
}

export const WithError: Story = {
  args: {
    label: 'Team',
    error: 'Pick a team size.',
  },
}

export const Disabled: Story = {
  args: {
    label: 'Team',
    defaultValue: 'Solo founder',
    disabled: true,
  },
}
