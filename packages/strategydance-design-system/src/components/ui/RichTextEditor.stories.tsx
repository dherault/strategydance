import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { RichText } from 'strategydance-design-system/components/ui/RichText'
import richTextSample from 'strategydance-design-system/components/ui/RichText.sample'
import { RichTextEditor } from 'strategydance-design-system/components/ui/RichTextEditor'

const meta = {
  title: 'Components/RichTextEditor',
  component: RichTextEditor,
  args: {
    placeholder: 'What moved forward today?',
    className: 'max-w-xl',
  },
} satisfies Meta<typeof RichTextEditor>

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithValue: Story = {
  args: {
    initialValue: richTextSample,
  },
}

// Lists and the four formats, and no heading or quote, as a top priority is written
export const ListsOnly: Story = {
  args: {
    blocks: ['list'],
  },
}

export const AutoFocus: Story = {
  args: {
    autoFocus: true,
  },
}

// What is typed, drawn back by RichText below as a feed would, with the shortcut counted
export const RoundTrip: Story = {
  render: args => <RoundTripExample {...args} />,
}

function RoundTripExample(props: Parameters<typeof RichTextEditor>[0]) {
  const [value, setValue] = useState<string | null>(null)
  const [submitCount, setSubmitCount] = useState(0)

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <RichTextEditor
        {...props}
        className={undefined}
        onChange={({ value: nextValue }) => setValue(nextValue)}
        onSubmit={() => setSubmitCount(count => count + 1)}
      />
      <p className="text-xs text-muted-foreground">Submitted {submitCount} times with ⌘Enter</p>
      {value ? <RichText value={value} /> : null}
    </div>
  )
}
