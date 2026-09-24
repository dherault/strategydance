import type { Meta, StoryObj } from '@storybook/react-vite'
import { SparklesIcon } from 'lucide-react'

import { Badge } from 'strategydance-design-system/components/ui/Badge'

const variants = ['neutral', 'primary', 'secondary', 'success', 'warning', 'danger'] as const

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: {
    children: 'In review',
  },
} satisfies Meta<typeof Badge>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Appearances: Story = {
  render: args => (
    <div className="flex flex-col gap-3">
      {(['subtle', 'solid', 'outline'] as const).map(appearance => (
        <div
          key={appearance}
          className="flex flex-wrap items-center gap-2"
        >
          {variants.map(variant => (
            <Badge
              key={variant}
              {...args}
              variant={variant}
              appearance={appearance}
              dot
            >
              {variant}
            </Badge>
          ))}
        </div>
      ))}
    </div>
  ),
}

export const Small: Story = {
  args: {
    size: 'sm',
    variant: 'primary',
  },
}

export const WithIcon: Story = {
  args: {
    children: 'Suggested',
    variant: 'secondary',
    icon: <SparklesIcon />,
  },
}
