import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
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
import { RichTextEditor, type RichTextEditorHandle } from 'strategydance-design-system/components/ui/RichTextEditor'

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

/*
  A page's body under its title, as a knowledge document is written: no frame, as tall as its text,
  the side menu in the margin to its left. Enter in the title moves the caret into the body
*/
export const Document: Story = {
  args: {
    appearance: 'document',
    initialValue: richTextSample,
    placeholder: 'Start writing',
    className: undefined,
  },
  parameters: {
    docs: {
      story: {
        height: '720px',
      },
    },
  },
  render: args => <DocumentExample {...args} />,
}

function DocumentExample(props: Parameters<typeof RichTextEditor>[0]) {
  const editorRef = useRef<RichTextEditorHandle>(null)

  return (
    <div className="mx-auto flex max-w-[768px] flex-col gap-6 px-16">
      <input
        aria-label="Title"
        placeholder="Untitled"
        defaultValue="Positioning for the beta"
        className="w-full border-0 bg-transparent p-0 font-heading text-5xl leading-[1.1] text-secondary outline-none placeholder:text-neutral-400"
        onKeyDown={event => {
          if (event.key !== 'Enter') return

          event.preventDefault()
          editorRef.current?.focus()
        }}
      />
      <RichTextEditor
        {...props}
        ref={editorRef}
        className="border-t border-neutral-200"
      />
    </div>
  )
}
