import type { Meta, StoryObj } from '@storybook/react-vite'
import { Progress } from 'strategydance-design-system/components/ui/Progress'

const meta = {
  title: 'Components/Progress',
  component: Progress,
  args: {
    value: 40,
    'aria-label': 'Uploading plan.pdf',
  },
  render: args => (
    <div className="max-w-xs">
      <Progress {...args} />
    </div>
  ),
} satisfies Meta<typeof Progress>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Values: Story = {
  render: () => (
    <div className="flex max-w-xs flex-col gap-4">
      {[0, 25, 60, 100].map(value => (
        <Progress
          key={value}
          value={value}
          aria-label={`${value}%`}
        />
      ))}
    </div>
  ),
}

export const Indeterminate: Story = {
  args: {
    value: null,
  },
}

// Thinner, along the foot of a box, as a file being uploaded shows it
export const AlongABox: Story = {
  render: args => (
    <div className="relative flex h-10 w-48 items-center overflow-hidden rounded-xs border border-border px-2.5 text-xs">
      plan.pdf
      <Progress
        {...args}
        className="absolute inset-x-0 bottom-0 h-0.5 rounded-none bg-transparent"
      />
    </div>
  ),
}
