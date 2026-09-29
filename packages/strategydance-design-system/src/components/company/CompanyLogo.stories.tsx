import type { Meta, StoryObj } from '@storybook/react-vite'
import { CompanyLogo } from 'strategydance-design-system/components/company/CompanyLogo'

// A stand-in logo, drawn inline so the stories need no asset. It is wider than tall, so the square
// shows how it is cropped
const LOGO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240"><rect width="360" height="240" fill="#fef3c7"/><circle cx="180" cy="120" r="84" fill="#d97706"/><circle cx="180" cy="120" r="40" fill="#fef3c7"/></svg>')}`

const meta = {
  title: 'Company/CompanyLogo',
  component: CompanyLogo,
  args: {
    name: 'Acme Robotics',
    src: LOGO,
  },
} satisfies Meta<typeof CompanyLogo>

export default meta

type Story = StoryObj<typeof meta>

export const Logo: Story = {}

export const Initials: Story = {
  args: {
    src: undefined,
  },
}

// The initials are white or near black, whichever reads on the company's color
export const Colors: Story = {
  args: {
    src: undefined,
    size: 'xl',
  },
  render: args => (
    <div className="flex items-center gap-3">
      {['#0051A3', '#142A41', '#16A34A', '#FACC15', '#BFDBFE'].map(color => (
        <CompanyLogo
          key={color}
          {...args}
          color={color}
        />
      ))}
    </div>
  ),
}

export const Sizes: Story = {
  render: args => (
    <div className="flex items-center gap-3">
      <CompanyLogo
        {...args}
        size="sm"
      />
      <CompanyLogo
        {...args}
        size="md"
      />
      <CompanyLogo
        {...args}
        size="lg"
      />
      <CompanyLogo
        {...args}
        size="xl"
      />
      <CompanyLogo
        {...args}
        size="2xl"
      />
    </div>
  ),
}

export const BrokenImage: Story = {
  args: {
    src: 'https://example.invalid/logo.png',
    color: '#16A34A',
    size: 'lg',
  },
}

// Beside the name it stands for, the logo is left out of the accessibility tree
export const BesideItsName: Story = {
  args: {
    alt: '',
  },
  render: args => (
    <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
      <CompanyLogo {...args} />
      {args.name}
    </div>
  ),
}
