import type { Meta, StoryObj } from '@storybook/react-vite'
import { CitationLink } from 'strategydance-design-system/components/ui/CitationLink'

const meta = {
  title: 'Components/CitationLink',
  component: CitationLink,
  args: {
    number: 1,
    href: 'https://www.notion.com/pricing',
    label: 'Source 1: Notion pricing',
  },
} satisfies Meta<typeof CitationLink>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

// As a reply draws it, after the spans it cites, two digits included
export const InText: Story = {
  render: args => (
    <p className="max-w-xl text-base/[1.6]">
      Notion charges 10 per member a month
      <CitationLink {...args} />, Coda 12
      <CitationLink
        {...args}
        number={2}
        label="Source 2: Coda pricing"
      />{' '}
      and Linear 8
      <CitationLink
        {...args}
        number={12}
        label="Source 12: Linear pricing"
      />
      .
    </p>
  ),
}
