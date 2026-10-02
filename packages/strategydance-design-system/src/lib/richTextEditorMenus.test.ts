import { describe, expect, it } from 'bun:test'

import { en } from '@blocknote/core/locales'
import { getRichTextBlockTypeSelectItems } from 'strategydance-design-system/lib/richTextEditorMenus'

describe('getRichTextBlockTypeSelectItems', () => {
  it('offers the three heading levels, without the toggle prop this heading lacks', () => {
    const headings = getRichTextBlockTypeSelectItems(en).filter(item => item.type === 'heading')

    expect(headings.map(item => [item.name, item.props])).toEqual([
      ['Heading 1', { level: 1 }],
      ['Heading 2', { level: 2 }],
      ['Heading 3', { level: 3 }],
    ])
  })
})
