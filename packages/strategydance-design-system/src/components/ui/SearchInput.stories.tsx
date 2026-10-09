import type { Meta, StoryObj } from '@storybook/react-vite'
import { SearchInput } from 'strategydance-design-system/components/ui/SearchInput'

const meta = {
  title: 'Components/SearchInput',
  component: SearchInput,
  args: {
    placeholder: 'Search conversations',
    'aria-label': 'Search conversations',
    className: 'w-full max-w-80',
  },
} satisfies Meta<typeof SearchInput>

export default meta

type Story = StoryObj<typeof meta>

export const Bare: Story = {}

export const Filled: Story = {
  args: {
    defaultValue: 'pricing strategy',
  },
}

export const WithHint: Story = {
  args: {
    defaultValue: 'pricing',
    hint: 'Searches titles and messages.',
  },
}

export const WithError: Story = {
  args: {
    defaultValue: 'one two three four five six seven eight nine',
    error: 'Search with up to 8 words.',
  },
}

export const Disabled: Story = {
  args: {
    defaultValue: 'pricing',
    disabled: true,
  },
}
