import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

const meta = {
  title: 'Components/Alert',
  component: Alert,
  args: {
    title: 'Your trial ends in 3 days',
    children: 'Add a payment method to keep your projects and their history.',
    className: 'max-w-lg',
  },
} satisfies Meta<typeof Alert>

export default meta

type Story = StoryObj<typeof meta>

export const Neutral: Story = {}

export const Variants: Story = {
  render: args => (
    <div className="flex max-w-lg flex-col gap-3">
      <Alert
        {...args}
        variant="neutral"
      />
      <Alert
        {...args}
        variant="info"
      />
      <Alert
        {...args}
        variant="success"
        title="Pricing saved"
      >
        The beta page now shows €19 a month.
      </Alert>
      <Alert
        {...args}
        variant="warning"
      />
      <Alert
        {...args}
        variant="danger"
        title="The payment failed"
      >
        Your card was declined. Try another one.
      </Alert>
    </div>
  ),
}

export const WithActions: Story = {
  args: {
    variant: 'info',
    actions: (
      <>
        <Button size="sm">
          Add a payment method
        </Button>
        <Button
          size="sm"
          variant="transparent"
        >
          Remind me tomorrow
        </Button>
      </>
    ),
  },
}

export const Dismissible: Story = {
  args: {
    onDismiss: fn(),
  },
}

export const TitleOnly: Story = {
  args: {
    variant: 'success',
    title: 'All caught up',
    children: undefined,
  },
}
