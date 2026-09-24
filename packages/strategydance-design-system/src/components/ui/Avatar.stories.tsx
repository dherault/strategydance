import type { Meta, StoryObj } from '@storybook/react-vite'

import { Avatar, AvatarGroup } from 'strategydance-design-system/components/ui/Avatar'

const photo = 'https://randomuser.me/api/portraits/men/32.jpg'

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  args: {
    name: 'Tom Harris',
    src: photo,
  },
} satisfies Meta<typeof Avatar>

export default meta

type Story = StoryObj<typeof meta>

export const Photo: Story = {}

export const Initials: Story = {
  args: {
    src: undefined,
  },
}

export const Sizes: Story = {
  render: args => (
    <div className="flex items-center gap-3">
      <Avatar
        {...args}
        size="sm"
      />
      <Avatar
        {...args}
        size="md"
      />
      <Avatar
        {...args}
        size="lg"
      />
      <Avatar
        {...args}
        size="xl"
      />
    </div>
  ),
}

export const BrokenImage: Story = {
  args: {
    src: 'https://example.invalid/avatar.png',
    size: 'lg',
  },
}

export const Group: Story = {
  render: () => (
    <AvatarGroup>
      <Avatar
        name="Tom Harris"
        src={photo}
      />
      <Avatar name="Grace Hopper" />
      <Avatar name="Alan Turing" />
      <Avatar name="Katherine Johnson" />
    </AvatarGroup>
  ),
}
