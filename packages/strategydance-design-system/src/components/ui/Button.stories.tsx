import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowRightIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import { Button } from 'strategydance-design-system/components/ui/Button'
import { Spinner } from 'strategydance-design-system/components/ui/Spinner'

const meta = {
  title: 'Components/Button',
  component: Button,
  args: {
    children: 'Save changes',
  },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = {}

export const Variants: Story = {
  render: args => (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        {...args}
        variant="primary"
      >
        Primary
      </Button>
      <Button
        {...args}
        variant="secondary"
      >
        Secondary
      </Button>
      <Button
        {...args}
        variant="outline"
      >
        Outline
      </Button>
      <Button
        {...args}
        variant="transparent"
      >
        Transparent
      </Button>
      <Button
        {...args}
        variant="danger"
      >
        Delete
      </Button>
    </div>
  ),
}

export const Sizes: Story = {
  render: args => (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        {...args}
        size="sm"
      >
        Small
      </Button>
      <Button
        {...args}
        size="md"
      >
        Medium
      </Button>
      <Button
        {...args}
        size="lg"
      >
        Large
      </Button>
    </div>
  ),
}

export const WithIcon: Story = {
  render: args => (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        {...args}
        icon={<PlusIcon />}
      >
        New project
      </Button>
      <Button
        {...args}
        variant="outline"
        icon={<ArrowRightIcon />}
        iconPosition="end"
      >
        Continue
      </Button>
      <Button
        {...args}
        variant="secondary"
        icon={<Spinner tone="current" />}
        disabled
      >
        Saving
      </Button>
    </div>
  ),
}

export const IconOnly: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        icon={<PlusIcon />}
        aria-label="Add"
      />
      <Button
        size="md"
        variant="transparent"
        icon={<PlusIcon />}
        aria-label="Add"
      />
      <Button
        size="lg"
        variant="danger"
        icon={<Trash2Icon />}
        aria-label="Delete"
      />
    </div>
  ),
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

// The first click asks, the second acts. Left alone, an armed button reverts after three seconds
export const Confirm: Story = {
  render: args => (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        {...args}
        variant="danger"
        confirm
      >
        Delete project
      </Button>
      <Button
        {...args}
        variant="danger"
        icon={<Trash2Icon />}
        confirm="Delete it?"
      >
        Delete
      </Button>
      <Button
        variant="danger"
        icon={<Trash2Icon />}
        aria-label="Delete"
        confirm
      />
    </div>
  ),
}
