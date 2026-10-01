import type { RichTextBlock } from 'strategydance-design-system/lib/richText'

// A post using every block, style and kind of list the editor writes, shared by the stories and the tests
const richTextSampleBlocks: RichTextBlock[] = [
  {
    type: 'paragraph',
    content: [
      { type: 'text', text: 'Task feed p95 is down from 410ms to 230ms. Two indexes on ' },
      { type: 'text', text: 'task_assignments', styles: { bold: true } },
      { type: 'text', text: ' did most of the work, as the ' },
      {
        type: 'link',
        href: 'https://www.postgresql.org/docs/current/indexes.html',
        content: [{ type: 'text', text: 'Postgres docs' }],
      },
      { type: 'text', text: ' promised.' },
    ],
  },
  { type: 'heading', content: [{ type: 'text', text: 'Left to reach 200ms' }] },
  {
    type: 'bulletListItem',
    content: [{ type: 'text', text: 'Remove the N+1 query on comments', styles: { italic: true } }],
    children: [{ type: 'bulletListItem', content: [{ type: 'text', text: 'Batch the authors in one read' }] }],
  },
  {
    type: 'bulletListItem',
    content: [{ type: 'text', text: 'Cache org settings per request', styles: { underline: true, strike: true } }],
  },
  {
    type: 'numberedListItem',
    props: { start: 3 },
    content: [{ type: 'text', text: 'Profile the feed again' }],
  },
  { type: 'numberedListItem', content: [{ type: 'text', text: 'Write it up' }] },
  { type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'Ship the indexes' }] },
  {
    type: 'checkListItem',
    content: [{ type: 'text', text: 'Watch the dashboard for a week' }],
    children: [{ type: 'checkListItem', content: [{ type: 'text', text: 'Alert past 300ms' }] }],
  },
  {
    type: 'quote',
    content: [
      { type: 'text', text: 'This is the first one the whole team opens every morning.\nAnd the last one at night.' },
    ],
  },
]

const richTextSample = JSON.stringify(richTextSampleBlocks)

export default richTextSample
