import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { PasswordInput } from 'strategydance-design-system/components/ui/PasswordInput'

const meta = {
  title: 'Components/PasswordInput',
  component: PasswordInput,
  args: {
    placeholder: '••••••••',
    className: 'max-w-xs',
  },
} satisfies Meta<typeof PasswordInput>

export default meta

type Story = StoryObj<typeof meta>

export const Bare: Story = {}

export const WithLabel: Story = {
  args: {
    label: 'New password',
    hint: 'At least 8 characters.',
  },
}

export const Visible: Story = {
  args: {
    label: 'Password',
    defaultValue: 'correct horse battery staple',
    defaultVisible: true,
  },
}

export const WithError: Story = {
  args: {
    label: 'New password',
    defaultValue: 'short',
    error: 'Use at least 8 characters.',
  },
}

export const Disabled: Story = {
  args: {
    label: 'Password',
    defaultValue: 'correct horse battery staple',
    disabled: true,
  },
}

// Both fields hold one `visible` between them, so either eye reveals the two
function PasswordInputsTogether() {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex max-w-xs flex-col gap-4">
      <PasswordInput
        label="New password"
        defaultValue="correct horse battery staple"
        visible={visible}
        onVisibleChange={setVisible}
      />
      <PasswordInput
        label="Confirm new password"
        defaultValue="correct horse battery staple"
        visible={visible}
        onVisibleChange={setVisible}
      />
    </div>
  )
}

export const RevealedTogether: Story = {
  render: () => <PasswordInputsTogether />,
}
