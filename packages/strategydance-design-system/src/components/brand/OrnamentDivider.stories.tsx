import type { Meta, StoryObj } from '@storybook/react-vite'
import { OrnamentDivider } from 'strategydance-design-system/components/brand/OrnamentDivider'

const meta = {
  title: 'Brand/OrnamentDivider',
  component: OrnamentDivider,
} satisfies Meta<typeof OrnamentDivider>

export default meta

type Story = StoryObj<typeof meta>

// Where it is used: white on primary, between the title of a full screen beat and what follows
export const OnPrimary: Story = {
  render: args => (
    <div className="flex flex-col items-center gap-6 bg-primary p-12 text-center text-white">
      <p className="m-0 text-3xl font-medium tracking-wider uppercase">Chapter 1</p>
      <OrnamentDivider {...args} />
      <h1 className="m-0 text-7xl leading-none text-white">Strategy</h1>
    </div>
  ),
}

// Two on one page, each with its own gradients
export const Colors: Story = {
  render: args => (
    <div className="flex flex-col items-center gap-6 p-12">
      <OrnamentDivider
        {...args}
        className="text-primary"
      />
      <OrnamentDivider
        {...args}
        className="text-secondary"
      />
    </div>
  ),
}
