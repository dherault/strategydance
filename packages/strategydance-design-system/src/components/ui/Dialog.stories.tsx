import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from 'strategydance-design-system/components/ui/Dialog'
import { Input } from 'strategydance-design-system/components/ui/Input'

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  parameters: {
    docs: {
      story: {
        height: '360px',
      },
    },
  },
  render: args => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">
          Add organization
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add an organization
          </DialogTitle>
          <DialogDescription>
            An organization holds a company and the people working on it.
          </DialogDescription>
        </DialogHeader>
        <Input
          label="Name"
          placeholder="Acme Inc."
        />
        <DialogFooter showCloseButton>
          <Button>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
} satisfies Meta<typeof Dialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  args: {
    defaultOpen: true,
  },
}
