import type { Meta, StoryObj } from '@storybook/react-vite'
import { UploadIcon } from 'lucide-react'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Field } from 'strategydance-design-system/components/ui/Field'

// A control that brings no label of its own, laid out as Input and Select lay themselves out
const meta = {
  title: 'Components/Field',
  component: Field,
  args: {
    label: 'Picture',
    hint: 'A square image of at least 256 pixels.',
    className: 'max-w-xs',
  },
  render: args => (
    <Field {...args}>
      <Button
        variant="secondary"
        size="sm"
        icon={<UploadIcon />}
        className="self-start"
      >
        Upload a picture
      </Button>
    </Field>
  ),
} satisfies Meta<typeof Field>

export default meta

type Story = StoryObj<typeof meta>

export const AroundAControl: Story = {}

export const WithError: Story = {
  args: {
    error: 'Use a PNG or a JPEG under 5 MB.',
  },
}
