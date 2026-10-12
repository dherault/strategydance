import type { RichTextBlock, RichTextMentionSource } from 'strategydance-design-system/lib/richText'

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
  // Big Buck Bunny, which the Blender Foundation publishes on YouTube
  { type: 'videoEmbed', props: { url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' } },
  {
    type: 'linkPreview',
    props: {
      url: 'https://www.postgresql.org/docs/current/indexes.html',
      title: 'Chapter 11. Indexes',
      description: 'Indexes are a common way to enhance database performance.',
      siteName: 'PostgreSQL Documentation',
      imageUrl: 'https://www.postgresql.org/media/img/about/press/elephant.png',
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

const PRICING_ID = '0b6f2c4d8e9a4b1c9d2e3f4a5b6c7d8e'
const ARCHIVED_ID = '3c1d9e8f7a6b4c5d8e9f0a1b2c3d4e5f'
const LAUNCH_ID = '7a1b2c3d4e5f40718293a4b5c6d7e8f9'

/*
  A task's description mentioning a document renamed since, one deleted since and a task, shared by
  the stories and the tests
*/
const richTextMentionSampleBlocks: RichTextBlock[] = [
  {
    type: 'paragraph',
    content: [
      { type: 'text', text: 'Price the beta as ' },
      { type: 'documentMention', props: { documentId: PRICING_ID, title: 'Pricing draft' } },
      { type: 'text', text: ' says, not as ' },
      { type: 'documentMention', props: { documentId: ARCHIVED_ID, title: 'Old pricing' } },
      { type: 'text', text: ' did, before ' },
      { type: 'taskMention', props: { taskId: LAUNCH_ID, name: 'Launch the beta' } },
      { type: 'text', text: '.' },
    ],
  },
]

export const richTextMentionSample = JSON.stringify(richTextMentionSampleBlocks)

// The organization's documents and tasks the sample mentions, the deleted one left out as the lists leave it out
export const richTextMentionSampleSource: RichTextMentionSource = {
  documents: new Map([
    [PRICING_ID, 'Pricing for the beta'],
    ['9e8d7c6b5a4f43e2a1b0c9d8e7f6a5b4', 'Positioning'],
    ['1a2b3c4d5e6f47a8b9c0d1e2f3a4b5c6', 'Hiring plan'],
  ]),
  tasks: new Map([
    [LAUNCH_ID, 'Launch the beta'],
    ['5f4e3d2c1b0a49f8e7d6c5b4a3f2e1d0', 'Write the pricing page'],
  ]),
  request: () => {},
  getHref: ({ kind, id }) => `#${kind}-${id}`,
}

export default richTextSample
