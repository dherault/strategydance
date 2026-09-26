import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'

import { ColorPicker } from 'strategydance-design-system/components/ui/ColorPicker'

// The picker is controlled, so each story holds its color in state
function ColorPickerDemo(props: Omit<ComponentProps<typeof ColorPicker>, 'value' | 'onChange'> & { initialValue?: string }) {
  const { initialValue = '#0051A3', ...rest } = props
  const [value, setValue] = useState(initialValue)

  return (
    <ColorPicker
      {...rest}
      value={value}
      onChange={setValue}
    />
  )
}

const meta = {
  title: 'Components/ColorPicker',
  component: ColorPicker,
  args: {
    value: '#0051A3',
    onChange: () => {},
    label: 'Primary color',
  },
  parameters: {
    layout: 'padded',
  },
  render: ({ value, onChange: _onChange, ...args }) => (
    <div className="max-w-[400px]">
      <ColorPickerDemo
        {...args}
        initialValue={value}
      />
    </div>
  ),
} satisfies Meta<typeof ColorPicker>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

// Opens above the trigger by default, so this one leaves room for it
export const Open: Story = {
  args: {
    defaultOpen: true,
  },
  parameters: {
    docs: {
      story: {
        height: '380px',
      },
    },
  },
  render: ({ value, onChange: _onChange, ...args }) => (
    <div className="max-w-[400px] pt-72">
      <ColorPickerDemo
        {...args}
        initialValue={value}
      />
    </div>
  ),
}

export const Below: Story = {
  args: {
    side: 'bottom',
    defaultOpen: true,
  },
  parameters: {
    docs: {
      story: {
        height: '380px',
      },
    },
  },
}

export const WithHint: Story = {
  args: {
    value: '#E11D48',
    hint: 'Fills your organization\'s mark wherever it has no logo.',
  },
}

export const WithError: Story = {
  args: {
    error: 'The color could not be saved.',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}
