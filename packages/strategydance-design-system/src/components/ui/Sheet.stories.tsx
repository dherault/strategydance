import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from 'strategydance-design-system/components/ui/Sheet'

const meta = {
  title: 'Components/Sheet',
  component: Sheet,
  render: args => (
    <Sheet {...args}>
      <SheetTrigger asChild>
        <Button variant="outline">
          Open the sheet
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            Pricing for the beta
          </SheetTitle>
          <SheetDescription>
            Set a price before Friday, so the first 20 users sign up knowing what it costs.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Button>
            Set pricing
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
} satisfies Meta<typeof Sheet>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  args: {
    defaultOpen: true,
  },
}
