import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from 'strategydance-design-system/components/ui/Dialog'
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
  parameters: {
    docs: {
      story: {
        height: '360px',
      },
    },
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

// Lists and check lists, and no heading or quote, as a top priority is written
export const PriorityBlocks: Story = {
  args: {
    blocks: ['list', 'checklist'],
  },
}

export const AutoFocus: Story = {
  args: {
    autoFocus: true,
  },
}

// BlockNote's menus in French
export const Localized: Story = {
  args: {
    locale: 'FR',
    placeholder: "Qu'est-ce qui a avancé aujourd'hui ?",
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

/*
  Inside a modal dialog, as the top priority is written. The slash menu, the toolbar over a
  selection and the drag handle's menu open inside the dialog, and Escape closes an open one before
  it closes the dialog
*/
export const InDialog: Story = {
  args: {
    initialValue: richTextSample,
    className: undefined,
  },
  parameters: {
    docs: {
      story: {
        height: '640px',
      },
    },
  },
  render: args => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Write the update</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Write the update</DialogTitle>
          <DialogDescription>What moved forward today.</DialogDescription>
        </DialogHeader>
        <RichTextEditor {...args} />
      </DialogContent>
    </Dialog>
  ),
}
