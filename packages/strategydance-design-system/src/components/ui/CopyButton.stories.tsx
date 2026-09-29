import type { Meta, StoryObj } from '@storybook/react-vite'
import { CopyButton } from 'strategydance-design-system/components/ui/CopyButton'

const variants = ['transparent', 'outline', 'secondary', 'primary'] as const

const meta = {
  title: 'Components/CopyButton',
  component: CopyButton,
  args: {
    value: 'ada@example.com',
  },
} satisfies Meta<typeof CopyButton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Variants: Story = {
  render: args => (
    <div className="flex flex-col gap-3">
      {(['sm', 'md', 'lg'] as const).map(size => (
        <div
          key={size}
          className="flex items-center gap-2"
        >
          {variants.map(variant => (
            <CopyButton
              key={variant}
              {...args}
              variant={variant}
              size={size}
            />
          ))}
        </div>
      ))}
    </div>
  ),
}

export const CustomLabels: Story = {
  args: {
    label: 'Copy the email address',
    copiedLabel: 'Email copied',
  },
}

export const BesideAValue: Story = {
  render: args => (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <span>{args.value}</span>
      <CopyButton {...args} />
    </div>
  ),
}
