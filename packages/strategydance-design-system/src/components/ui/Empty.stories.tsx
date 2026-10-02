import type { Meta, StoryObj } from '@storybook/react-vite'
import { BookOpenIcon, PlusIcon } from 'lucide-react'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

const meta = {
  title: 'Components/Empty',
  component: Empty,
  args: {
    className: 'max-w-3xl',
  },
} satisfies Meta<typeof Empty>

export default meta

type Story = StoryObj<typeof meta>

// A page's list with nothing in it yet, and the button that adds the first
export const Default: Story = {
  render: args => (
    <Empty {...args}>
      <EmptyHeader>
        <EmptyMedia>
          <BookOpenIcon />
        </EmptyMedia>
        <EmptyTitle>No knowledge yet</EmptyTitle>
        <EmptyDescription>
          Add notes, plans and decisions about your company. Tag each item with aspects so it shows up on those pages.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          size="sm"
          icon={<PlusIcon />}
        >
          Add knowledge
        </Button>
      </EmptyContent>
    </Empty>
  ),
}

// A section's, on a page with more than the list on it
export const Small: Story = {
  args: {
    size: 'sm',
  },
  render: args => (
    <Empty {...args}>
      <EmptyHeader>
        <EmptyMedia>
          <CompanyAspectIcon aspect="strategy" />
        </EmptyMedia>
        <EmptyTitle>No knowledge for Strategy yet</EmptyTitle>
        <EmptyDescription>Items tagged with Strategy appear here.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
}
