import type { Meta, StoryObj } from '@storybook/react-vite'

import { Logo } from 'strategydance-design-system/components/brand/Logo'

const meta = {
  title: 'Brand/Logo',
  component: Logo,
  args: {
    title: 'Strategy Dance',
    className: 'w-20 text-secondary',
  },
} satisfies Meta<typeof Logo>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Colors: Story = {
  render: args => (
    <div className="flex items-center gap-6">
      <Logo
        {...args}
        className="w-16 text-secondary"
      />
      <Logo
        {...args}
        className="w-16 text-black"
      />
      <div className="grid size-28 place-items-center rounded-xs bg-primary">
        <Logo
          {...args}
          className="w-16 text-white"
        />
      </div>
    </div>
  ),
}

// The lockup: the mark about 1.5 times the cap height, half its own height away from the name
export const Lockup: Story = {
  render: args => (
    <div className="flex items-center gap-3 text-secondary">
      <Logo
        {...args}
        title={undefined}
        className="h-6 w-auto"
      />
      <span className="font-sans text-xl font-bold tracking-[-0.02em]">
        Strategy Dance
      </span>
    </div>
  ),
}
