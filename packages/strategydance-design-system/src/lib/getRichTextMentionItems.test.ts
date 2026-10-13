import { describe, expect, it } from 'bun:test'

import { getRichTextMentionItems } from 'strategydance-design-system/lib/getRichTextMentionItems'
import type { RichTextMentionSource } from 'strategydance-design-system/lib/richText'

function createSource(overrides: Partial<RichTextMentionSource> = {}): RichTextMentionSource {
  return {
    documents: new Map([
      ['d1', 'Pricing plan'],
      ['d2', '  '],
      ['d3', 'Hiring PLAN'],
    ]),
    tasks: new Map([
      ['t1', 'Write the plan'],
      ['t2', 'Ship'],
    ]),
    request: () => {},
    getHref: ({ kind, id }) => `/${kind}/${id}`,
    ...overrides,
  }
}

describe('getRichTextMentionItems', () => {
  it('suggests the documents then the tasks whose title holds what is typed, whatever its case', () => {
    expect(getRichTextMentionItems(createSource(), ' plan')).toEqual([
      { kind: 'document', id: 'd1', title: 'Pricing plan' },
      { kind: 'document', id: 'd3', title: 'Hiring PLAN' },
      { kind: 'task', id: 't1', title: 'Write the plan' },
    ])
  })

  it('suggests no document without a title, nor what is being written', () => {
    expect(getRichTextMentionItems(createSource({ self: { kind: 'task', id: 't2' } }), '')).toEqual([
      { kind: 'document', id: 'd1', title: 'Pricing plan' },
      { kind: 'document', id: 'd3', title: 'Hiring PLAN' },
      { kind: 'task', id: 't1', title: 'Write the plan' },
    ])
  })

  it('suggests six of each kind at most, and nothing of a kind whose list is not read', () => {
    const documents = new Map(Array.from({ length: 9 }, (_, index) => [`d${index}`, `Doc ${index}`]))
    const items = getRichTextMentionItems(createSource({ documents, tasks: null }), 'doc')

    expect(items.map(item => item.id)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4', 'd5'])
  })
})
