import type { Meta, StoryObj } from '@storybook/react-vite'
import { PencilIcon } from 'lucide-react'
import { useState } from 'react'
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

// A field shown only while editing, as a task's links are: the pencil opens the list over what is
// picked, and closing it goes back to reading
function EditedOnDemand() {
  const [picked, setPicked] = useState(['Newsletter', 'LinkedIn'])
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="flex max-w-xs flex-col gap-2 font-sans text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">Channels</span>
        <Button
          variant="transparent"
          size="sm"
          icon={<PencilIcon />}
          aria-label="Edit channels"
          onClick={() => setIsEditing(true)}
        />
      </div>
      {isEditing ? (
        <MultiSelect
          options={channels}
          value={picked}
          defaultOpen
          aria-label="Channels"
          onValueChange={setPicked}
          onOpenChange={isOpen => {
            if (!isOpen) setIsEditing(false)
          }}
        />
      ) : (
        <p className="m-0 text-foreground">{picked.join(', ') || 'None'}</p>
      )}
    </div>
  )
}

export const OpenedOnDemand: Story = {
  parameters: {
    docs: {
      story: {
        height: '420px',
      },
    },
  },
  render: () => <EditedOnDemand />,
}
