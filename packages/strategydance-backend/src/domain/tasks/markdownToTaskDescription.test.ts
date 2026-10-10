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
