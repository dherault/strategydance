import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from 'strategydance-design-system/components/ui/Button'
import { Toaster, toast } from 'strategydance-design-system/components/ui/Toaster'

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

const meta = {
  title: 'Components/Toaster',
  component: Toaster,
  render: args => (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => toast('Saved')}
        >
          Default
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.success('Pricing saved', { description: 'The beta page now shows €19 a month.' })}
        >
          Success
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.info('Two calls on Thursday')}
        >
          Info
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.warning('Your trial ends in 3 days')}
        >
          Warning
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.error('The payment failed', { description: 'Your card was declined.' })}
        >
          Error
        </Button>
        <Button
          variant="outline"
          onClick={() => toast('Task archived', {
            action: { label: 'Undo', onClick: () => {} },
            cancel: { label: 'Dismiss', onClick: () => {} },
          })}
        >
          With actions
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.promise(wait(2000), {
            loading: 'Publishing the page',
            success: 'Page published',
            error: 'The page did not publish',
          })}
        >
          Promise
        </Button>
      </div>
      <Toaster {...args} />
    </>
  ),
} satisfies Meta<typeof Toaster>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const RichColors: Story = {
  args: {
    richColors: true,
  },
}

export const CloseButton: Story = {
  args: {
    closeButton: true,
  },
}

export const Expanded: Story = {
  args: {
    expand: true,
    position: 'top-right',
  },
}
