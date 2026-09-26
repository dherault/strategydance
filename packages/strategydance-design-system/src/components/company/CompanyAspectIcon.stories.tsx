import type { Meta, StoryObj } from '@storybook/react-vite'

import { CompanyAspectIcon, CompanyAspects } from 'strategydance-design-system/components/company/CompanyAspectIcon'

const meta = {
  title: 'Company/CompanyAspectIcon',
  component: CompanyAspectIcon,
  args: {
    aspect: 'strategy',
  },
} satisfies Meta<typeof CompanyAspectIcon>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Large: Story = {
  args: {
    size: 32,
    title: 'Strategy',
    className: 'text-primary',
  },
}

export const AllAspects: Story = {
  render: () => (
    <ul className="m-0 flex max-w-sm list-none flex-col gap-2 p-0">
      {CompanyAspects.map(aspect => (
        <li
          key={aspect.id}
          className="flex items-center gap-3 text-sm text-foreground"
        >
          <CompanyAspectIcon
            aspect={aspect.id}
            className="text-secondary"
          />
          {aspect.label}
        </li>
      ))}
    </ul>
  ),
}
