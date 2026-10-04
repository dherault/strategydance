import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState } from 'react'
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
import richTextSample, { richTextDocumentSample } from 'strategydance-design-system/components/ui/RichText.sample'
import { RichTextEditor, type RichTextEditorHandle } from 'strategydance-design-system/components/ui/RichTextEditor'
import { createRichTextYUpdate } from 'strategydance-design-system/lib/createRichTextYUpdate'
import { RICH_TEXT_EDITOR_BLOCKS, RICH_TEXT_POST_BLOCKS } from 'strategydance-design-system/lib/richText'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'

/*
  Stores a picture as an upload would, after a moment, answering with an address only this page
  can load: RichText draws only a web address, so a round trip draws the picture's place empty
*/
async function uploadImage(file: File) {
  await new Promise(resolve => setTimeout(resolve, 800))

  return URL.createObjectURL(file)
}

const meta = {
  title: 'Components/RichTextEditor',
  component: RichTextEditor,
  // A post's blocks, as the log writes them, but in the stories of a document
  args: {
    placeholder: 'What moved forward today?',
    blocks: RICH_TEXT_POST_BLOCKS,
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

// The same with a document's blocks, which RichText draws back as a document's
export const DocumentRoundTrip: Story = {
  args: {
    initialValue: richTextDocumentSample,
    blocks: RICH_TEXT_EDITOR_BLOCKS,
    uploadImage,
  },
  parameters: {
    docs: {
      story: {
        height: '1200px',
      },
    },
  },
  render: args => <RoundTripExample {...args} />,
}

function RoundTripExample(props: Parameters<typeof RichTextEditor>[0]) {
  const [value, setValue] = useState<string | null>(props.initialValue ?? null)
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
      {value ? (
        <RichText
          value={value}
          blocks={props.blocks}
        />
      ) : null}
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
  the side menu in the margin to its left. Below `md` the page leaves no margin, as a phone's does,
  and the side menu sits in the body's own gutter instead. Enter in the title moves the caret into
  the body
*/
export const Document: Story = {
  args: {
    appearance: 'document',
    initialValue: richTextDocumentSample,
    blocks: RICH_TEXT_EDITOR_BLOCKS,
    uploadImage,
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
    <div className="mx-auto flex max-w-[768px] flex-col gap-6 px-2 md:px-16">
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

/*
  One text written by two people at once, as a shared knowledge document is: what either types
  lands in the other's editor, and each shows the other's caret and name while they type. Each
  editor has a Yjs document of its own, linked to the other's here as the server links them, since
  two editors on one document would be one writer to Yjs, and neither would draw the other's caret
*/
export const Collaborative: Story = {
  args: {
    appearance: 'document',
    blocks: RICH_TEXT_EDITOR_BLOCKS,
    uploadImage,
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
  render: args => <CollaborativeExample {...args} />,
}

// What one writer's document and awareness say, as received by the other
const REMOTE = Symbol('remote')

type Writer = {
  doc: Y.Doc
  awareness: Awareness
}

function createWriter(seed: Uint8Array): Writer {
  const doc = new Y.Doc()

  Y.applyUpdate(doc, seed, REMOTE)

  return { doc, awareness: new Awareness(doc) }
}

// Sends what one writer does to the other, and leaves alone what arrived from the other
function link(from: Writer, to: Writer) {
  function sendUpdate(update: Uint8Array, origin: unknown) {
    if (origin !== REMOTE) Y.applyUpdate(to.doc, update, REMOTE)
  }

  function sendAwareness(
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) {
    if (origin === REMOTE) return

    applyAwarenessUpdate(
      to.awareness,
      encodeAwarenessUpdate(from.awareness, [...added, ...updated, ...removed]),
      REMOTE,
    )
  }

  from.doc.on('update', sendUpdate)
  from.awareness.on('update', sendAwareness)

  return () => {
    from.doc.off('update', sendUpdate)
    from.awareness.off('update', sendAwareness)
  }
}

function CollaborativeExample(props: Parameters<typeof RichTextEditor>[0]) {
  const [writers, setWriters] = useState<{ ana: Writer; ben: Writer } | null>(null)

  /*
    Each awareness keeps a timer, so both are made in the effect that destroys them, and StrictMode's
    extra cycle makes a second pair. They reach the story a microtask later, from the effect still
    running. Both open on the same first update, so they hold one copy of the text
  */
  useEffect(() => {
    const seed = createRichTextYUpdate(richTextDocumentSample)
    const next = { ana: createWriter(seed), ben: createWriter(seed) }
    const unlinkAna = link(next.ana, next.ben)
    const unlinkBen = link(next.ben, next.ana)
    let isActive = true

    queueMicrotask(() => {
      if (isActive) setWriters(next)
    })

    return () => {
      isActive = false
      unlinkAna()
      unlinkBen()
      next.ana.awareness.destroy()
      next.ben.awareness.destroy()
    }
  }, [])

  if (!writers) return null

  return (
    <div className="grid grid-cols-2 gap-12 px-16">
      <RichTextEditor
        {...props}
        aria-label="Ana's editor"
        collaboration={{ ...writers.ana, user: { name: 'Ana', color: '#0a61b5' } }}
        className="border-t border-neutral-200"
      />
      <RichTextEditor
        {...props}
        aria-label="Ben's editor"
        collaboration={{ ...writers.ben, user: { name: 'Ben', color: '#c2410c' } }}
        className="border-t border-neutral-200"
      />
    </div>
  )
}
