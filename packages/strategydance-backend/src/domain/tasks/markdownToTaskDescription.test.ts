import { describe, expect, it } from 'bun:test'

import { MAX_TASK_DESCRIPTION_LENGTH } from 'strategydance-core'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'

import markdownToTaskDescription from './markdownToTaskDescription'
import taskDescriptionToMarkdown from './taskDescriptionToMarkdown'

function write(markdown: string) {
  const written = markdownToTaskDescription(markdown)

  if (written.outcome !== 'written') throw new Error(`Refused: ${written.outcome}`)

  return written
}

describe('markdownToTaskDescription', () => {
  it('stores a post as its blocks, with its plain text', () => {
    const written = write('# Launch\n\nShip the **beta**\n\n- Email the list\n- [x] Draft the post')

    expect(parseRichText(written.description).map(block => block.type)).toEqual([
      'heading',
      'paragraph',
      'bulletListItem',
      'checkListItem',
    ])
    expect(written.descriptionText).toBe('Launch\nShip the beta\nEmail the list\nDraft the post')
    expect(taskDescriptionToMarkdown(written.description)).toBe(
      '# Launch\n\nShip the **beta**\n\n- Email the list\n- [x] Draft the post',
    )
  })

  it("writes a table as a paragraph per row, keeping every cell's text, and code as a paragraph of its lines", () => {
    const written = write(
      '| Channel | Owner |\n| --- | --- |\n| Email | **Sam** |\n| Blog | Ada |\n\n```ts\nconst a = 1\nconst b = 2\n```',
    )
    const blocks = parseRichText(written.description)

    expect(blocks.map(block => block.type)).toEqual(['paragraph', 'paragraph', 'paragraph', 'paragraph'])
    expect(written.descriptionText).toBe('Channel | Owner\nEmail | Sam\nBlog | Ada\nconst a = 1\nconst b = 2')
    expect(written.description).toContain('"bold":true')
  })

  it("stores the agent's links to documents and tasks as mentions, in a table's rows too, read back as written", () => {
    const markdown =
      'Price it as [Pricing](doc:0b6f2c4d8e9a4b1c9d2e3f4a5b6c7d8e) says, before [Launch](task:7a1b2c3d4e5f40718293a4b5c6d7e8f9)'
    const written = write(`${markdown}\n\n| Next |\n| --- |\n| [Launch](task:7a1b2c3d4e5f40718293a4b5c6d7e8f9) |`)
    const [paragraph, header, row] = parseRichText(written.description)

    expect(paragraph).toEqual({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Price it as ' },
        { type: 'documentMention', props: { documentId: '0b6f2c4d8e9a4b1c9d2e3f4a5b6c7d8e', title: 'Pricing' } },
        { type: 'text', text: ' says, before ' },
        { type: 'taskMention', props: { taskId: '7a1b2c3d4e5f40718293a4b5c6d7e8f9', name: 'Launch' } },
      ],
    })
    expect(header).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'Next' }] })
    expect(row).toEqual({
      type: 'paragraph',
      content: [{ type: 'taskMention', props: { taskId: '7a1b2c3d4e5f40718293a4b5c6d7e8f9', name: 'Launch' } }],
    })
    expect(written.descriptionText).toBe('Price it as Pricing says, before Launch\nNext\nLaunch')
    expect(taskDescriptionToMarkdown(written.description)).toBe(
      `${markdown}\n\nNext\n\n[Launch](task:7a1b2c3d4e5f40718293a4b5c6d7e8f9)`,
    )
  })

  it('stores nothing for Markdown that says nothing', () => {
    expect(write('')).toEqual({ outcome: 'written', description: '', descriptionText: '' })
    expect(write('   \n\n')).toEqual({ outcome: 'written', description: '', descriptionText: '' })
  })

  it('loads no picture, keeping a link to it', () => {
    const written = write('![Chart](https://example.com/chart.png)')

    expect(written.description).not.toContain('"image"')
    expect(written.descriptionText).toBe('Chart')
  })

  it('refuses a description past what a task holds once stored', () => {
    expect(markdownToTaskDescription('word '.repeat(MAX_TASK_DESCRIPTION_LENGTH / 5))).toEqual({
      outcome: 'descriptionTooLong',
    })
  })
})
