import type { RichTextBlock } from 'strategydance-design-system/lib/richText'

// A post using every block, style and kind of list a post is written in, shared by the stories and the tests
const richTextSampleBlocks: RichTextBlock[] = [
  { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Feed performance' }] },
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
  { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'This week' }] },
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

// A knowledge document: the post, then every block a document adds to it
const richTextDocumentSampleBlocks: RichTextBlock[] = [
  ...richTextSampleBlocks,
  {
    type: 'table',
    content: {
      type: 'tableContent',
      headerRows: 1,
      columnWidths: [180, null, null],
      rows: [
        {
          cells: [
            [{ type: 'text', text: 'Endpoint' }],
            [{ type: 'text', text: 'Before' }],
            [{ type: 'text', text: 'After' }],
          ],
        },
        {
          cells: [
            [{ type: 'text', text: '/feed', styles: { bold: true } }],
            [{ type: 'text', text: '410ms' }],
            [{ type: 'text', text: '230ms' }],
          ],
        },
        {
          cells: [[{ type: 'text', text: '/tasks', styles: { bold: true } }], [{ type: 'text', text: '180ms' }], []],
        },
      ],
    },
  },
  {
    type: 'image',
    props: {
      url: 'https://strategydance.com/assets/images/logo/logo-primary-borders-background-512.png',
      name: 'The Strategy Dance mark',
      caption: 'The mark the feed shows beside each post',
      previewWidth: 160,
    },
  },
  { type: 'heading', content: [{ type: 'text', text: 'The indexes' }] },
  {
    type: 'codeBlock',
    props: { language: 'sql' },
    content: [
      {
        type: 'text',
        text: 'create index task_assignments_task_id\n  on task_assignments (task_id);\n\nanalyze task_assignments;',
      },
    ],
  },
]

export const richTextDocumentSample = JSON.stringify(richTextDocumentSampleBlocks)

export default richTextSample
