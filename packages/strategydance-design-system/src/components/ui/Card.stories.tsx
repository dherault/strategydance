import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from 'strategydance-design-system/components/ui/Button'
import { Card } from 'strategydance-design-system/components/ui/Card'

const meta = {
  title: 'Components/Card',
  component: Card,
  args: {
    title: 'Pricing for the beta',
    description: 'Set a price before Friday, so the first 20 users sign up knowing what it costs.',
    className: 'max-w-sm',
  },
} satisfies Meta<typeof Card>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithContent: Story = {
  args: {
    children: (
      <div className="flex gap-2">
        <Button size="sm">
          Set pricing
        </Button>
        <Button
          size="sm"
          variant="transparent"
        >
          Later
        </Button>
      </div>
    ),
  },
}

export const BodyOnly: Story = {
  args: {
    title: undefined,
    description: undefined,
    children: (
      <p className="m-0 text-sm">
        A card needs neither a title nor a description.
      </p>
    ),
  },
}
