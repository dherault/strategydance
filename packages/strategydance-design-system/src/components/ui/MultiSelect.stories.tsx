import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from 'strategydance-design-system/components/ui/Dialog'
import { MultiSelect } from 'strategydance-design-system/components/ui/MultiSelect'

const channels = ['Newsletter', 'LinkedIn', 'X', 'YouTube', 'Podcast', 'Product Hunt', 'Reddit']

const aspects = [
  {
    label: 'Build',
    options: ['Product', 'Engineering', 'Design'],
  },
  {
    label: 'Grow',
    options: ['Marketing', 'Sales', { value: 'Partnerships', label: 'Partnerships', disabled: true }],
  },
  {
    label: 'Run',
    options: [
      'Strategy',
      'Finances',
      'Legal',
      { value: 'People and operations', label: 'People and operations', keywords: ['hiring', 'team'] },
    ],
  },
]

const meta = {
  title: 'Components/MultiSelect',
  component: MultiSelect,
  args: {
    options: channels,
    placeholder: 'Distribution channels',
    className: 'max-w-xs',
  },
  parameters: {
    docs: {
      story: {
        height: '120px',
      },
    },
  },
} satisfies Meta<typeof MultiSelect>

export default meta

type Story = StoryObj<typeof meta>

// With no visible label, the trigger and the list it opens are named by `aria-label`
export const Default: Story = {
  args: {
    'aria-label': 'Distribution channels',
  },
}

export const WithLabel: Story = {
  args: {
    label: 'Distribution channels',
    hint: 'Chips that do not fit collapse into a count.',
    defaultValue: ['Newsletter', 'LinkedIn', 'YouTube', 'Podcast'],
  },
}

export const Groups: Story = {
  args: {
    label: 'Focus areas',
    options: aspects,
    defaultValue: ['Product', 'Marketing', 'Engineering', 'Legal'],
    selectAll: true,
    searchPlaceholder: 'Search areas…',
    placeholder: 'Pick focus areas',
  },
}

export const Open: Story = {
  args: {
    ...Groups.args,
    defaultOpen: true,
  },
  parameters: {
    layout: 'padded',
    docs: {
      story: {
        height: '420px',
      },
    },
  },
}

export const MaxCount: Story = {
  args: {
    label: 'Distribution channels',
    hint: 'At most two chips, whatever the width.',
    defaultValue: ['Newsletter', 'LinkedIn', 'YouTube', 'Podcast'],
    maxCount: 2,
    className: 'max-w-md',
  },
}

export const WithError: Story = {
  args: {
    label: 'Reviewers',
    options: ['Ana', 'Luca', 'Mira'],
    placeholder: 'Choose reviewers',
    error: 'Pick at least one reviewer.',
  },
}

export const Disabled: Story = {
  args: {
    label: 'Distribution channels',
    defaultValue: ['X', 'Reddit'],
    disabled: true,
  },
}

export const InDialog: Story = {
  args: {
    label: 'Distribution channels',
    defaultValue: ['Newsletter'],
    className: undefined,
  },
  parameters: {
    docs: {
      story: {
        height: '480px',
      },
    },
  },
  render: args => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Plan the launch</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan the launch</DialogTitle>
          <DialogDescription>Where the launch goes out first.</DialogDescription>
        </DialogHeader>
        <MultiSelect {...args} />
      </DialogContent>
    </Dialog>
  ),
}
