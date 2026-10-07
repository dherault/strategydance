import type { Meta, StoryObj } from '@storybook/react-vite'
import { FileTextIcon } from 'lucide-react'
import { CitationLink } from 'strategydance-design-system/components/ui/CitationLink'
import { Markdown, type MarkdownLink } from 'strategydance-design-system/components/ui/Markdown'
import {
  markdownSampleDocuments,
  markdownSampleReplies,
} from 'strategydance-design-system/components/ui/Markdown.sample'

const documentIconClassName = 'mr-[3px] inline-block size-[13px] align-[-2px]'

// A knowledge link as the thread draws it: the document's current title, or struck through once it is deleted
function renderDocumentLink({ href, children }: MarkdownLink) {
  const title = markdownSampleDocuments.get(href.slice('doc:'.length))

  if (!title) {
    return (
      <span className="text-muted-foreground line-through">
        <FileTextIcon className={documentIconClassName} />
        {children}
      </span>
    )
  }

  return (
    <a
      href="#knowledge"
      className="font-medium text-primary no-underline hover:text-primary-800 hover:underline"
    >
      <FileTextIcon className={documentIconClassName} />
      {title}
    </a>
  )
}

const meta = {
  title: 'Components/Markdown',
  component: Markdown,
  args: {
    value: markdownSampleReplies[1],
    renderLink: renderDocumentLink,
  },
} satisfies Meta<typeof Markdown>

export default meta

type Story = StoryObj<typeof meta>

// The conversation page's thread, a 768px column at 16px
export const Page: Story = {
  args: {
    size: 'md',
  },
  render: args => (
    <div className="flex max-w-3xl flex-col gap-4">
      {markdownSampleReplies.map(reply => (
        <Markdown
          key={reply}
          {...args}
          value={reply}
        />
      ))}
    </div>
  ),
}

// A dock window's thread, 352px wide at 14px
export const Dock: Story = {
  args: {
    size: 'sm',
  },
  render: args => (
    <div className="flex w-[352px] flex-col gap-4 px-3">
      {markdownSampleReplies.map(reply => (
        <Markdown
          key={reply}
          {...args}
          value={reply}
        />
      ))}
    </div>
  ),
}

/*
  The heading is a bold paragraph, the `<b>` tag is text, the script and relative links are their
  words, the image is its alt text and never loads, the code block keeps its lines, the quote its
  words, and a single tilde strikes nothing
*/
export const Untrusted: Story = {
  args: {
    className: 'max-w-3xl',
    value: [
      '# A heading',
      '<b onmouseover="alert(1)">Markup</b> is text, a [script link](javascript:alert(1)) is its words, and so is a [relative one](/today).',
      '![An image is its alt text](https://example.com/tracker.png)',
      '```\nA code block keeps\nits lines\n```',
      '> A quote keeps its words',
      'It takes ~5 to ~10 minutes, and ~~this~~ is struck.',
    ].join('\n\n'),
  },
}

const citedReply = [
  'Notion charges **10 per member** a month on its Plus plan, and Coda 12 on its Pro plan.',
  '- Linear starts at 8, with [its own pricing page](https://linear.app/pricing) for teams.',
  '- All three bill yearly by default.',
].join('\n\n')

const citedSources = [
  { number: 1, href: 'https://www.notion.com/pricing', title: 'Notion pricing' },
  { number: 2, href: 'https://coda.io/pricing', title: 'Coda pricing' },
  { number: 3, href: 'https://linear.app/pricing', title: 'Linear pricing' },
]

/*
  A reply web search cited, each marker right after the span it cites: in bold, in plain text,
  after a link rather than inside it, and at a list item's end, two markers side by side
*/
export const Citations: Story = {
  args: {
    className: 'max-w-3xl',
    value: citedReply,
    citations: [
      { offset: citedReply.indexOf(' a month'), key: '1' },
      { offset: citedReply.indexOf(' on its Pro'), key: '2' },
      { offset: citedReply.indexOf(' for teams'), key: '3' },
      { offset: citedReply.indexOf('default.') + 'default.'.length, key: '1' },
      { offset: citedReply.indexOf('default.') + 'default.'.length, key: '2' },
    ],
    renderCitation: key => {
      const source = citedSources.find(({ number }) => String(number) === key)

      return source ? (
        <CitationLink
          number={source.number}
          href={source.href}
          label={`Source ${source.number}: ${source.title}`}
        />
      ) : null
    },
  },
}
