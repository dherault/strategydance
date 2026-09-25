import type { Meta, StoryObj } from '@storybook/react-vite'

import { Skeleton } from 'strategydance-design-system/components/ui/Skeleton'

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
} satisfies Meta<typeof Skeleton>

export default meta

type Story = StoryObj<typeof meta>

export const Card: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-3 rounded-xs border border-border bg-card p-6">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  ),
}
