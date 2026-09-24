import type { Meta, StoryObj } from '@storybook/react-vite'

import { Pill } from 'strategydance-design-system/components/ui/Pill'

const variants = ['primary', 'secondary', 'neutral', 'danger'] as const

const meta = {
  title: 'Components/Pill',
  component: Pill,
  args: {
    count: 4,
  },
} satisfies Meta<typeof Pill>

export default meta

type Story = StoryObj<typeof meta>

export const Count: Story = {}

export const Variants: Story = {
  render: args => (
    <div className="flex flex-col gap-3">
      {(['md', 'sm'] as const).map(size => (
        <div
          key={size}
          className="flex items-center gap-2"
        >
          {variants.map(variant => (
            <Pill
              key={variant}
              {...args}
              variant={variant}
              size={size}
            />
          ))}
          {variants.map(variant => (
            <Pill
              key={variant}
              variant={variant}
              size={size}
            />
          ))}
        </div>
      ))}
    </div>
  ),
}

export const OverMax: Story = {
  args: {
    count: 128,
  },
}

export const NoMax: Story = {
  args: {
    count: 128,
    max: null,
  },
}

export const Dot: Story = {
  args: {
    count: undefined,
  },
}
