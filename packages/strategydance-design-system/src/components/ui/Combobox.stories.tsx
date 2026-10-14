import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Combobox } from 'strategydance-design-system/components/ui/Combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from 'strategydance-design-system/components/ui/Dialog'

const owners = ['Ana', 'Luca', 'Mira', 'Noah', 'Sofia', 'Strategy Dance']

// A board's tasks, grouped by column, as the build in public cards pick one
const tasks = [
  {
    label: 'Backlog',
    options: [
      { value: 'pricing', label: 'Rework the pricing page around the three plans', keywords: ['plans'] },
      { value: 'referrals', label: 'Referral program' },
    ],
  },
  {
    label: 'To do',
    options: [
      { value: 'onboarding', label: 'Onboarding emails' },
      { value: 'changelog', label: 'Public changelog', disabled: true },
    ],
  },
  {
    label: 'Ongoing',
    options: [
      { value: 'launch', label: 'Launch on Product Hunt' },
      { value: 'interviews', label: 'Interview ten customers about how they plan their week' },
    ],
  },
  {
    label: 'Done',
    options: [{ value: 'landing', label: 'Landing page' }],
  },
]

const meta = {
  title: 'Components/Combobox',
  component: Combobox,
  args: {
    options: owners,
    placeholder: 'Choose an owner',
    className: 'max-w-xs',
  },
  parameters: {
    docs: {
      story: {
        height: '120px',
      },
    },
  },
} satisfies Meta<typeof Combobox>

export default meta

type Story = StoryObj<typeof meta>

// With no visible label, the trigger and the list it opens are named by `aria-label`
export const Default: Story = {
  args: {
    'aria-label': 'Owner',
  },
}

export const WithLabel: Story = {
  args: {
    label: 'Owner',
    hint: 'Type to narrow the list.',
    defaultValue: 'Mira',
  },
}

// Long options are cut short on one line, in the list and in the trigger
export const Groups: Story = {
  args: {
    label: 'Task',
    options: tasks,
    defaultValue: 'interviews',
    searchPlaceholder: 'Search tasks…',
    emptyText: 'No tasks found.',
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

export const WithError: Story = {
  args: {
    label: 'Owner',
    error: 'Pick who owns it.',
  },
}

export const Disabled: Story = {
  args: {
    label: 'Owner',
    defaultValue: 'Luca',
    disabled: true,
  },
}

// Inside a modal dialog the list portals into the dialog, so it takes clicks, and Escape closes the
// list rather than the dialog
export const InDialog: Story = {
  args: {
    label: 'Task',
    options: tasks,
    defaultValue: 'launch',
    searchPlaceholder: 'Search tasks…',
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
        <Button variant="outline">Share a task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share a task</DialogTitle>
          <DialogDescription>Which task the card shows.</DialogDescription>
        </DialogHeader>
        <Combobox {...args} />
      </DialogContent>
    </Dialog>
  ),
}
